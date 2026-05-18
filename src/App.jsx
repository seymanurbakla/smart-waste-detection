import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

// Components
import HomeScreen from './components/HomeScreen';
import CameraScreen from './components/CameraScreen';
import UploadScreen from './components/UploadScreen';
import ResultScreen from './components/ResultScreen';
import ErrorScreen from './components/ErrorScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('camera');
  const [predictionResult, setPredictionResult] = useState(null);
  const [analyzedImage, setAnalyzedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
    if (screen === 'camera') {
      setPredictionResult(null);
      setAnalyzedImage(null);
    }
  };

  const handleResultReady = (result, imageSrc) => {
    setPredictionResult(result);
    setAnalyzedImage(imageSrc);
    setCurrentScreen('result');
  };

  return (
    <div className="w-full min-h-screen bg-black overflow-hidden font-sans">
      <AnimatePresence mode="wait">

        {currentScreen === 'camera' && (
          <CameraScreen 
            key="camera" 
            onNavigate={navigateTo} 
            onResultReady={handleResultReady}
          />
        )}

        {currentScreen === 'loading' && (
          <div key="loading" className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-medium animate-pulse">Atık analiz ediliyor...</h2>
          </div>
        )}

        {currentScreen === 'result' && predictionResult && (
          <ResultScreen 
            key="result"
            result={predictionResult}
            imageSrc={analyzedImage}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'error' && (
          <ErrorScreen key="error" onNavigate={navigateTo} />
        )}

      </AnimatePresence>
    </div>
  );
}
