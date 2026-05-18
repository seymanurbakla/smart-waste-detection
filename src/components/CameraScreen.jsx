import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Loader2, Send } from 'lucide-react';

export default function CameraScreen({ onNavigate, onResultReady }) {
  const videoRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [stream, setStream] = useState(null);
  
  // States for live detection
  const [detection, setDetection] = useState(null);
  const [lastFrame, setLastFrame] = useState(null);

  useEffect(() => {
    let activeStream;
    let interval;
    
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        activeStream = stream;
        setStream(stream);
        setHasPermission(true);

        // Start live detection
        interval = setInterval(() => {
          analyzeFrame();
        }, 800); // Check every 800ms

      } catch (err) {
        console.error("Camera access error:", err);
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (interval) clearInterval(interval);
    };
  }, []);

  const analyzeFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    if (canvas.width === 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const frameSrc = canvas.toDataURL('image/jpeg', 0.6); // Compress slightly for speed

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frameSrc })
      });
      const data = await response.json();
      
      if (response.ok && data.class && data.class !== 'unknown' && data.confidence >= 0.05) {
        setDetection(data);
        setLastFrame(frameSrc);
      } else {
        setDetection(null);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleSend = () => {
    if (detection && lastFrame) {
      onResultReady(detection, lastFrame);
    }
  };

  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl max-w-sm w-full">
          <div className="text-red-500 mb-4 flex justify-center">
            <Camera size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Kamera İzni Gerekli</h2>
          <p className="text-gray-600 mb-6">Bu özelliği kullanabilmek için tarayıcı ayarlarından kameraya izin verin.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-900 flex flex-col relative"
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-center items-center text-white pt-10">
        <span className="font-bold text-2xl bg-black/60 px-6 py-3 rounded-full backdrop-blur-md shadow-lg border border-white/20">
          Hadi Atığını Göster!
        </span>
      </div>

      {/* Center Camera View */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 mt-10">
        <div className="relative w-full max-w-md aspect-square bg-black rounded-[2rem] overflow-hidden shadow-2xl border-4 border-gray-800">
          {hasPermission === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={48} />
            </div>
          )}
          
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover"
          />

          {/* Bounding Box Overlay */}
          {detection && detection.box && (
            <div 
              className="absolute border-4 border-green-400 bg-green-400/20 shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all duration-200 pointer-events-none"
              style={{
                left: `${detection.box.x1 * 100}%`,
                top: `${detection.box.y1 * 100}%`,
                width: `${(detection.box.x2 - detection.box.x1) * 100}%`,
                height: `${(detection.box.y2 - detection.box.y1) * 100}%`,
              }}
            >
            </div>
          )}
        </div>
        
        {/* External Label Right Below Camera */}
        <div className="h-16 mt-6 w-full flex items-center justify-center">
          {detection && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-xl shadow-lg border-2 border-white/20"
            >
              Algılanan: {detection.class.toUpperCase()} (%{Math.round(detection.confidence * 100)})
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-32 flex justify-center items-center px-6 pb-8 z-20">
        <button 
          onClick={handleSend}
          disabled={!detection}
          className={`w-full max-w-sm py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg shadow-xl transition-all duration-300 ${
            detection 
              ? 'bg-green-500 text-white hover:bg-green-400 hover:scale-105 active:scale-95' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          <Send size={24} />
          {detection ? "Hangi Kutuya Atacağım?" : "Nesne Aranıyor..."}
        </button>
      </div>
    </motion.div>
  );
}
