import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Camera, Upload } from 'lucide-react';

export default function ErrorScreen({ onNavigate }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <AlertCircle size={40} />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Atığını tanıyamadık</h2>
        <p className="text-gray-500 mb-8 font-medium">Lütfen daha net bir görselle tekrar deneyelim.</p>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => onNavigate('camera')}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-black text-white py-4 rounded-xl font-semibold shadow-md transition-all"
          >
            <Camera size={20} />
            Kamerayla Tekrar Dene
          </button>
          
          <button 
            onClick={() => onNavigate('upload')}
            className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold transition-all"
          >
            <Upload size={20} />
            Başka Görsel Yükle
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
