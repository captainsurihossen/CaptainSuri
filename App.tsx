
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { startJarvisSession, stopJarvisSession } from './services/jarvisService.ts';
import { ChatMessage, FunctionCallInfo, AssistantStatus } from './types.ts';
import { MicIcon, StopIcon } from './components/Icons.tsx';
import { CommandDisplay } from './components/CommandDisplay.tsx';
import { ChatHistory } from './components/ChatHistory.tsx';

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Tap to Start');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [jarvisTranscript, setJarvisTranscript] = useState('');
  const [lastFunctionCall, setLastFunctionCall] = useState<FunctionCallInfo | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const userTranscriptRef = useRef('');
  const jarvisTranscriptRef = useRef('');
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    setInstallPrompt(null);
  };


  const handleStatusUpdate = useCallback((newStatus: AssistantStatus, message: string) => {
    setStatus(newStatus);
    setStatusMessage(message);
  }, []);

  const handleUserTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && transcript.trim()) {
      setHistory(prev => [...prev, { role: 'user', text: transcript }]);
      setUserTranscript('');
      userTranscriptRef.current = '';
    } else {
      setUserTranscript(transcript);
      userTranscriptRef.current = transcript;
    }
  }, []);

  const handleJarvisTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && transcript.trim()) {
      setHistory(prev => [...prev, { role: 'jarvis', text: transcript }]);
      setJarvisTranscript('');
      jarvisTranscriptRef.current = '';
    } else {
      setJarvisTranscript(transcript);
      jarvisTranscriptRef.current = transcript;
    }
  }, []);

  const handleFunctionCall = useCallback((functionCall: FunctionCallInfo) => {
    setLastFunctionCall(functionCall);
    setTimeout(() => setLastFunctionCall(null), 4000); // Hide command after 4s
  }, []);
  
  const handleImageGenerated = useCallback((imageUrl: string, prompt: string) => {
      setHistory(prev => [...prev, {
        role: 'jarvis',
        imageUrl: imageUrl,
        text: `Here is your image of: "${prompt}"`
      }]);
  }, []);

  const handleError = useCallback((error: string) => {
    setStatus('error');
    setStatusMessage(error);
  }, []);


  const toggleSession = async () => {
    if (status !== 'idle' && status !== 'error') {
      await stopJarvisSession();
      handleStatusUpdate('idle', 'Tap to Start');
    } else {
      await startJarvisSession({
        onStatusUpdate: handleStatusUpdate,
        onUserTranscript: handleUserTranscript,
        onJarvisTranscript: handleJarvisTranscript,
        onFunctionCall: handleFunctionCall,
        onImageGenerated: handleImageGenerated,
        onError: handleError,
      });
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopJarvisSession();
    };
  }, []);

  const getOrbClass = () => {
    switch (status) {
      case 'connecting':
        return 'animate-spin border-cyan-400';
      case 'listening':
        return 'animate-pulse border-green-400';
      case 'speaking':
      case 'thinking':
        return 'animate-pulse border-cyan-400';
      case 'error':
        return 'border-red-500';
      default:
        return 'border-gray-600';
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden relative">
      <div className="absolute inset-0 bg-grid-cyan-500/10"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
      
      <main className="z-10 flex flex-col items-center justify-between w-full h-full max-h-[100vh]">
        <h1 className="text-3xl sm:text-4xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] my-4 sm:my-6">J.A.R.V.I.S</h1>
        
        <ChatHistory history={history} userTranscript={userTranscript} jarvisTranscript={jarvisTranscript} />
        
        <div className="w-full max-w-md my-6">
             <CommandDisplay functionCall={lastFunctionCall} />
        </div>

        <div className="flex flex-col items-center gap-4 py-4 sm:py-6">
          <button
            onClick={toggleSession}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 shadow-lg
              ${status !== 'idle' && status !== 'error' ? 'bg-cyan-500/20' : 'bg-gray-800'}`}
          >
            <div className={`absolute inset-0 rounded-full border-4 transition-all duration-300 ${getOrbClass()}`}></div>
            {status !== 'idle' && status !== 'error' ? (
                <StopIcon className="w-10 h-10 text-cyan-400"/>
            ) : (
                <MicIcon className="w-10 h-10 text-cyan-400"/>
            )}
          </button>
          <p className="text-cyan-200 text-center min-h-[1.5rem]">{statusMessage}</p>
        </div>
      </main>

      <footer className="absolute bottom-4 text-center w-full z-20">
         {installPrompt && (
          <button 
            onClick={handleInstallClick} 
            className="absolute bottom-4 left-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            Install App
          </button>
        )}
        <p className="text-gray-500 text-sm">Created by CAPTAIN SURI</p>
      </footer>
    </div>
  );
};

export default App;