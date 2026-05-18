import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Home, Recycle } from 'lucide-react';

const CLASS_CONFIG = {
  paper: {
    bgClass: 'bg-gradient-to-br from-blue-50 to-blue-200',
    title: 'Kağıt Atıklar',
    bin: 'MAVİ KUTU',
    textColor: 'text-blue-900',
    binColor: '#2563EB', // Deep blue
    emoji: '📰' // Newspaper / crumpled paper
  },
  plastic: {
    bgClass: 'bg-gradient-to-br from-yellow-50 to-yellow-200',
    title: 'Plastik Atıklar',
    bin: 'SARI KUTU',
    textColor: 'text-yellow-900',
    binColor: '#EAB308', // Vibrant yellow
    emoji: '🥤' // Plastic bottle / Cup
  },
  glass: {
    bgClass: 'bg-gradient-to-br from-green-50 to-green-200',
    title: 'Cam Atıklar',
    bin: 'YEŞİL KUTU',
    textColor: 'text-green-900',
    binColor: '#16A34A', // Deep green
    emoji: '🫙' // Glass jar / bottle
  },
  metal: {
    bgClass: 'bg-gradient-to-br from-gray-100 to-gray-300',
    title: 'Metal Atıklar',
    bin: 'GRİ KUTU',
    textColor: 'text-gray-900',
    binColor: '#4B5563', // Deep gray
    emoji: '🥫' // Metal can
  },
  household: {
    bgClass: 'bg-gradient-to-br from-orange-50 to-orange-200',
    title: 'Evsel Atıklar',
    bin: 'TURUNCU KUTU',
    textColor: 'text-orange-900',
    binColor: '#EA580C', // Bright orange
    emoji: '🍌' // Organic / Banana
  }
};

export default function ResultScreen({ result, imageSrc, onNavigate }) {
  const config = CLASS_CONFIG[result.class.toLowerCase()] || CLASS_CONFIG.household;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-screen ${config.bgClass} flex items-center justify-center p-6 transition-colors duration-700 overflow-hidden relative`}
    >
      {/* Decorative Background blur circles for more depth */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 z-10">

        {/* LEFT COLUMN: Text and Info */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          className="flex-1 flex flex-col items-start text-left w-full max-w-lg"
        >
          <span className="font-semibold px-5 py-3 rounded-full mb-6 shadow-sm backdrop-blur-md bg-white/60 text-gray-800 border border-white/40 text-lg">
            Atığının hangi kutuya gideceğine karar verdik!
          </span>

          <h1 className={`text-6xl md:text-8xl font-black mb-6 drop-shadow-sm uppercase tracking-tighter ${config.textColor}`}>
            {config.bin}
          </h1>

          {/* Glassmorphic Info Card */}
          <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] p-8 w-full shadow-xl mb-8">
            <p className={`text-2xl font-medium mb-3 ${config.textColor}`}>
              Tespit Edilen: <span className="font-extrabold">{config.title}</span>
            </p>
            <p className={`text-xl font-bold opacity-90 ${config.textColor}`}>
              Lütfen atığını bu kutuya at. <span className="text-emerald-600 ml-1">Tebrikler! ✨</span>
            </p>

            {imageSrc && (
              <div className="w-32 h-32 rounded-2xl overflow-hidden mt-6 border-4 border-white/80 shadow-md">
                <img src={imageSrc} alt="Scanned waste" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-4">
            <button
              onClick={() => onNavigate('camera')}
              className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all hover:scale-105 active:scale-95 bg-white/50 text-gray-800 hover:bg-white/70 shadow-sm border border-white/50 text-lg"
            >
              <RefreshCcw size={20} />
              Tekrar Dene
            </button>
            <button
              onClick={() => onNavigate('home')}
              className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all hover:scale-105 active:scale-95 bg-gray-900 text-white hover:bg-black shadow-xl text-lg"
            >
              <Home size={20} />
              Ana Sayfa
            </button>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: Huge Animated Bin */}
        <motion.div 
          className="flex-1 flex justify-center items-end min-h-[500px] w-full relative pointer-events-none pb-10"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
        >
          {/* Bin Container - 3D Effect Structure */}
          <div className="relative w-64 h-[22rem] drop-shadow-2xl flex items-end justify-center">

            {/* Particle Explosion Effect (Stars and glowing dust) */}
            {[
              { x: -140, y: -60, type: 'star', size: 28 },
              { x: -100, y: -140, type: 'dot', size: 10 },
              { x: -70, y: -80, type: 'star', size: 18 },
              { x: -120, y: -100, type: 'dot', size: 6 },
              { x: 140, y: -70, type: 'star', size: 24 },
              { x: 110, y: -130, type: 'dot', size: 12 },
              { x: 80, y: -50, type: 'star', size: 20 },
              { x: 130, y: -110, type: 'dot', size: 8 },
              { x: -40, y: -180, type: 'star', size: 22 },
              { x: 30, y: -190, type: 'dot', size: 14 },
              { x: 50, y: -130, type: 'star', size: 16 },
              { x: -10, y: -100, type: 'dot', size: 8 },
            ].map((p, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, scale: 0, x: '-50%', y: 0 }}
                animate={{ 
                  opacity: [0, 0, 1, 1, 0], 
                  scale: [0, 0, 1, 1, 0.5], 
                  x: ['-50%', '-50%', `calc(-50% + ${p.x * 0.8}px)`, `calc(-50% + ${p.x}px)`, `calc(-50% + ${p.x * 1.1}px)`], 
                  y: [0, 0, p.y * 0.7, p.y, p.y * 1.2] 
                }}
                transition={{ 
                  delay: 1.1, 
                  duration: 2.5, 
                  times: [0, 0.44, 0.48, 0.85, 1], // Slower, floating up longer (0.45 relates to the impact hit time of the main emoji)
                  ease: "easeOut",
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
                className={`absolute top-20 left-1/2 flex items-center justify-center z-30 ${p.type === 'star' ? 'drop-shadow-[0_0_15px_rgba(253,224,71,0.8)] text-yellow-100' : 'bg-yellow-50 rounded-full shadow-[0_0_15px_6px_rgba(253,224,71,0.7)]'}`}
                style={{ 
                  width: p.type === 'dot' ? p.size : 'auto', 
                  height: p.type === 'dot' ? p.size : 'auto',
                  fontSize: p.type === 'star' ? p.size : 'inherit'
                }}
              >
                {p.type === 'star' && '✨'}
              </motion.div>
            ))}

            {/* Bin Interior (Back Wall) -> this sits behind the waste */}
            <div className="absolute bottom-0 w-full h-72 rounded-t-lg rounded-b-3xl bg-black/30 z-0"></div>

            {/* CUSTOM Waste dropping animation (Emoji based on class!) */}
            <motion.div
              initial={{ y: -300, opacity: 0, scale: 0.5, rotate: 0 }}
              animate={{ y: 200, opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8], rotate: 180 }}
              transition={{
                delay: 1.1,
                duration: 1.5,
                times: [0, 0.2, 0.7, 1],
                ease: "easeIn",
                repeat: Infinity,
                repeatDelay: 1.5
              }}
              className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10 flex items-center justify-center text-7xl md:text-8xl drop-shadow-2xl"
            >
              {config.emoji}
            </motion.div>

            {/* Bin Base (Front Wall) -> covers the dropping waste */}
            <div className="absolute bottom-0 w-full h-72 rounded-b-3xl z-20 flex flex-col items-center justify-center" style={{ backgroundColor: config.binColor }}>
              {/* Bold, Solid White Recycle Symbol as requested */}
              <div className="mb-8 drop-shadow-md z-30">
                <Recycle size={110} strokeWidth={3} color="#ffffff" className="opacity-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
              </div>
              
              {/* Dark internal rim to give 3D depth illusion */}
              <div className="w-full h-6 bg-black/20 absolute top-0"></div>
            </div>

            {/* BIG Bin Lid - Animates Open */}
            <motion.div
              initial={{ rotate: 0, originX: 0, originY: 1 }}
              animate={{ rotate: -105 }}
              transition={{ delay: 0.7, type: "spring", bounce: 0.6, duration: 1.5 }}
              className="absolute top-16 left-0 w-full h-10 rounded-t-2xl shadow-lg z-30"
              style={{ backgroundColor: config.binColor }}
            >
              {/* Handle */}
              <div className="w-20 h-4 bg-white/40 mx-auto absolute -top-4 left-1/2 transform -translate-x-1/2 rounded-t-lg"></div>
            </motion.div>

          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
