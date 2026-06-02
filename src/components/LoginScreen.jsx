import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, TreePine, Sprout, Lock, User, Loader2 } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // DUMMY LOGIN — backend'e gitmeden direkt yönlendir.
    setTimeout(() => {
      onLoginSuccess('dummy-token');
      setLoading(false);
    }, 200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-emerald-700 via-green-600 to-emerald-800"
    >
      {/* Decorative nature icons */}
      <Leaf className="absolute top-10 left-8 text-white/15" size={120} />
      <TreePine className="absolute bottom-12 right-8 text-white/15" size={140} />
      <Sprout className="absolute top-1/2 left-4 text-white/10" size={80} />

      {/* Card */}
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 text-white"
      >
        <div className="flex flex-col items-center mb-6">
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="bg-white/20 p-4 rounded-2xl mb-4"
          >
            <Leaf size={40} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight">Smart Waste</h1>
          <p className="text-sm text-white/80 mt-1">Devam etmek için giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Kullanıcı adı"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 placeholder:text-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parola"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 placeholder:text-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm bg-red-500/30 border border-red-300/50 text-white rounded-lg px-3 py-2"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white text-emerald-700 font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : null}
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
