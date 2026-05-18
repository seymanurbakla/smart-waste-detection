import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Check, Image as ImageIcon } from 'lucide-react';

export default function UploadScreen({ onNavigate, onUpload }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    if (selectedImage) {
      onUpload(selectedImage);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative"
    >
      <div className="absolute top-6 left-6">
        <button 
          onClick={() => onNavigate('home')}
          className="p-3 bg-white text-gray-800 rounded-full shadow-md hover:bg-gray-100 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden mt-10">
        <div className="p-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Görsel Yükle</h2>
          <p className="text-gray-500">Atığının net bir fotoğrafını seç.</p>
        </div>

        <div className="p-8 flex flex-col items-center">
          {!selectedImage ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square border-4 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all group"
            >
              <div className="bg-gray-100 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <ImageIcon size={48} className="text-gray-500" />
              </div>
              <span className="font-medium">Dosya seçmek için dokun</span>
            </div>
          ) : (
            <div className="w-full aspect-square rounded-3xl overflow-hidden relative shadow-inner">
              <img src={selectedImage} alt="Selected waste" className="w-full h-full object-cover" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-sm"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="mt-8 w-full flex flex-col gap-3">
            {selectedImage ? (
              <button 
                onClick={handleConfirm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <Check size={24} />
                Görseli Analiz Et
              </button>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <Upload size={24} />
                Fotoğraf Seç
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
