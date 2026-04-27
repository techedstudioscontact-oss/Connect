
import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinished: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),      // Fade in "Teched Studios"
      setTimeout(() => setStage(2), 2500),     // Fade out "Teched Studios", start fade in logo
      setTimeout(() => setStage(3), 4500),     // Logo fully visible
      setTimeout(onFinished, 5500)            // Transition to app
    ];

    return () => timers.forEach(clearTimeout);
  }, [onFinished]);

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-sky-900 text-white overflow-hidden animate-background-pan">
      <div className="absolute inset-0 bg-black opacity-30"></div>
      
      <div className="z-10 flex flex-col items-center justify-center transition-opacity duration-1000">
        <div className={`transition-opacity duration-1000 ${stage === 1 ? 'opacity-100' : 'opacity-0'}`}>
            <h1 className="text-2xl font-semibold text-slate-300 animate-fade-in-down">
                Teched Studios Presents
            </h1>
        </div>

        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ${stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
            <div className="flex flex-col items-center animate-pulse-logo">
              <img src="/assets/logo.svg" alt="CollabSea Logo" className="h-24 w-24" />
              <h2 className="text-5xl font-extrabold mt-4 font-wordmark flex items-center justify-center tracking-tight">
                <span className="text-white drop-shadow-md">Collab</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 drop-shadow-sm">Sea</span>
              </h2>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;