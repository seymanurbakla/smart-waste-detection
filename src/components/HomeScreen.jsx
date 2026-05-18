import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload, Leaf, TreePine, Sprout, Cloud } from 'lucide-react';

export default function HomeScreen({ onNavigate }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
    >
      {/* Decorative nature background elements */}
      <div className="absolute top-12 left-10 text-emerald-300/30">
        <Cloud size={100} />
      </div>
      <div className="absolute top-24 right-16 text-emerald-300/40">
        <Cloud size={140} />
      </div>
      <div className="absolute bottom-10 left-10 text-green-600/10">
        <TreePine size={200} />
      </div>
      <div className="absolute bottom-12 right-12 text-green-600/10">
        <TreePine size={160} />
      </div>
      <div className="absolute top-1/2 left-20 text-emerald-400/20 transform -translate-y-1/2">
        <Sprout size={80} />
      </div>
      <div className="absolute bottom-1/3 right-24 text-green-500/15 transform rotate-45">
        <Leaf size={60} />
      </div>
      <div className="absolute top-32 left-1/3 text-emerald-400/20 transform -rotate-12">
        <Leaf size={40} />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        className="z-10 bg-white/70 p-10 rounded-[3rem] backdrop-blur-xl shadow-2xl border border-white/50 w-full max-w-lg"
      >
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="bg-gradient-to-tr from-green-400 to-emerald-500 p-5 rounded-full inline-flex mb-6 shadow-lg shadow-green-500/30"
        >
          <Leaf className="text-white" size={48} />
        </motion.div>
        
        {/* Much larger Smart Waste text */}
        <h1 className="text-6xl md:text-7xl font-black text-gray-800 mb-3 tracking-tight">Smart Waste</h1>
        
        <h2 className="text-2xl font-bold text-gray-600 mb-4">Atığını Kameraya Göster!</h2>
        <p className="text-gray-500 mb-10 max-w-sm mx-auto font-medium">
          Doğru kutuyu bulmak için atığını kameraya göster veya bir fotoğrafını yükle.
        </p>

        {/* Square Buttons Layout (Left: Upload, Right: Camera) */}
        <div className="flex flex-row justify-center items-center gap-6 w-full">
          
          {/* Left: Upload Image */}
          <button 
            onClick={() => onNavigate('upload')}
            className="group flex flex-col items-center justify-center gap-4 bg-white hover:bg-emerald-50 text-emerald-700 w-40 h-40 rounded-3xl transition-all border-2 border-emerald-100 shadow-lg hover:shadow-xl hover:-translate-y-1 focus:ring-4 focus:ring-emerald-200"
          >
            <div className="bg-emerald-100 p-4 rounded-full group-hover:scale-110 transition-transform">
              <Upload size={32} />
            </div>
            <span className="font-bold text-lg">Görsel Yükle</span>
          </button>

          {/* Right: Open Camera */}
          <button 
            onClick={() => onNavigate('camera')}
            className="group flex flex-col items-center justify-center gap-4 bg-emerald-600 hover:bg-emerald-500 text-white w-40 h-40 rounded-3xl transition-all shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-1 focus:ring-4 focus:ring-emerald-300"
          >
            <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform backdrop-blur-sm">
              <Camera size={32} />
            </div>
            <span className="font-bold text-lg">Kamera Aç</span>
          </button>
          
        </div>
      </motion.div>
    </motion.div>
  );
}
