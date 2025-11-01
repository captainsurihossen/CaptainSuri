import React from 'react';

export const LoginScreen: React.FC = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-cyan-500/10"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] mb-3">
          J.A.R.V.I.S
        </h1>
        <p className="text-lg text-gray-300 mb-8 max-w-md">
          A sophisticated voice assistant powered by Gemini. Please sign in with your Google account to continue.
        </p>
        <div id="signInDiv"></div>
         <p className="text-xs text-gray-500 mt-8 max-w-sm">
            Note: For this sign-in to work, the developer must replace the placeholder Client ID in the code with a valid Google Cloud Client ID.
        </p>
      </div>
    </div>
  );
};
