import React, { useState, useCallback, useRef, useEffect } from 'react';
import { startJarvisSession, stopJarvisSession } from './services/jarvisService.ts';
// Fix: Removed AIStudio from import as global declaration is now handled in types.ts.
import { ChatMessage, FunctionCallInfo, AssistantStatus, GroundingSource } from './types.ts';
import { MicIcon, StopIcon } from './components/Icons.tsx';
import { CommandDisplay } from './components/CommandDisplay.tsx';
import { ChatHistory } from './components/ChatHistory.tsx';
import { SuggestionChips } from './components/SuggestionChips.tsx';

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Tap to start');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [jarvisTranscript, setJarvisTranscript] = useState('');
  const [lastFunctionCall, setLastFunctionCall] = useState<FunctionCallInfo | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [wakeWord, setWakeWord] = useState('Jarvis');
  const [wakeWordInput, setWakeWordInput] = useState('Jarvis');
  const [apiKeySelected, setApiKeySelected] = useState(false);

  const sourcesForNextMessage = useRef<GroundingSource[]>([]);
  const wakeWordDetectedInTurn = useRef(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (await window.aistudio.hasSelectedApiKey()) {
        setApiKeySelected(true);
      }
    };
    checkApiKey();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setApiKeySelected(true);
  };
  
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

  const handleSetWakeWord = () => {
    if (wakeWordInput.trim()) {
      setWakeWord(wakeWordInput.trim());
    }
  };

  const handleStatusUpdate = useCallback((newStatus: AssistantStatus, message: string) => {
    if (newStatus === 'listening') {
      setStatus('waitingForWakeWord');
      setStatusMessage(`Say "${wakeWord}" to activate`);
    } else {
      setStatus(newStatus);
      setStatusMessage(message);
    }
  }, [wakeWord]);
  
  const handleError = useCallback((error: string) => {
    setStatus('error');
    const lowerCaseError = error.toLowerCase();
    
    if (lowerCaseError.includes('network error') || lowerCaseError.includes('not found') || lowerCaseError.includes('api key')) {
      setApiKeySelected(false);
      setStatusMessage('API Key error. Please select a valid key to continue.');
    } else if (lowerCaseError.includes('service is currently unavailable')) {
      setStatusMessage('Service unavailable. Please try again shortly.');
    } else {
      setStatusMessage(error); // Default to showing the received error message.
    }
  }, []);

  const handleUserTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (status === 'waitingForWakeWord' && !wakeWordDetectedInTurn.current) {
        if (transcript.toLowerCase().includes(wakeWord.toLowerCase())) {
            setStatus('listening');
            setStatusMessage('Listening...');
            wakeWordDetectedInTurn.current = true;
        }
    }

    if (wakeWordDetectedInTurn.current) {
        const command = transcript.toLowerCase().replace(wakeWord.toLowerCase(), '').trim();
        if (isFinal) {
            if (command) {
                setHistory(prev => [...prev, { role: 'user', text: command }]);
            }
            setUserTranscript('');
        } else {
            setUserTranscript(command);
        }
    }
  }, [status, wakeWord]);

  const handleJarvisTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal && transcript.trim()) {
      const sources = sourcesForNextMessage.current;
      setHistory(prev => [...prev, { role: 'jarvis', text: transcript, sources: sources }]);
      setJarvisTranscript('');
      sourcesForNextMessage.current = [];
      setStatus('waitingForWakeWord');
      setStatusMessage(`Say "${wakeWord}" to activate`);
      wakeWordDetectedInTurn.current = false;
    } else {
      setJarvisTranscript(transcript);
    }
  }, [wakeWord]);

  const handleFunctionCall = useCallback((functionCall: FunctionCallInfo) => {
    setLastFunctionCall(functionCall);
    setTimeout(() => setLastFunctionCall(null), 4000);
  }, []);
  
  const handleImageGenerated = useCallback((imageUrl: string, description: string) => {
      setHistory(prev => [...prev, {
        role: 'jarvis',
        imageUrl: imageUrl,
        text: description
      }]);
  }, []);

  const handleGroundingSources = useCallback((sources: GroundingSource[]) => {
    sourcesForNextMessage.current = sources;
  }, []);

  const toggleSession = async () => {
    if (status !== 'idle' && status !== 'error') {
      await stopJarvisSession();
      handleStatusUpdate('idle', 'Tap to start');
      wakeWordDetectedInTurn.current = false;
    } else {
      await startJarvisSession({
        onStatusUpdate: handleStatusUpdate,
        onUserTranscript: handleUserTranscript,
        onJarvisTranscript: handleJarvisTranscript,
        onFunctionCall: handleFunctionCall,
        onImageGenerated: handleImageGenerated,
        onGroundingSources: handleGroundingSources,
        onError: handleError,
      });
    }
  };
  
  useEffect(() => {
    return () => {
      stopJarvisSession();
    };
  }, []);

  const getOrbClass = () => {
    switch (status) {
      case 'connecting':
        return 'animate-spin border-cyan-400';
      case 'waitingForWakeWord':
        return 'animate-pulse-slow border-gray-500';
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
      <style>{`
        @keyframes pulse-slow {
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
      <div className="absolute inset-0 bg-grid-cyan-500/10"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
      
      {!apiKeySelected ? (
         <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
            <h1 className="text-4xl sm:text-5xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] mb-3">
            J.A.R.V.I.S
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-md">
            Please select a Google AI Studio API key to continue.
            </p>
            <button
                onClick={handleSelectKey}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105"
            >
                Select API Key
            </button>
            <p className="text-xs text-gray-500 mt-6 max-w-sm">
                For more information on billing, see the{' '}
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                Gemini API documentation
                </a>.
            </p>
         </div>
      ) : (
        <main className="z-10 flex flex-col items-center justify-between w-full h-full max-h-[100vh]">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] my-4 sm:my-6">J.A.R.V.I.S</h1>
          
          <ChatHistory history={history} userTranscript={userTranscript} jarvisTranscript={jarvisTranscript} />
          
          {(status === 'idle' || status === 'error') && <SuggestionChips />}
          
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

          {(status === 'idle' || status === 'error') && (
            <div className="z-10 text-center animate-fade-in mb-12">
              <label htmlFor="wake-word-input" className="text-sm text-gray-400 block mb-2">
                Set Wake Word
              </label>
              <div className="flex justify-center items-center gap-2">
                <input
                  id="wake-word-input"
                  type="text"
                  value={wakeWordInput}
                  onChange={(e) => setWakeWordInput(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-md px-3 py-1 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none w-32"
                />
                <button
                  onClick={handleSetWakeWord}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-1 rounded-md transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      <footer className="absolute bottom-4 w-full z-20 px-4">
         {installPrompt && (
          <button 
            onClick={handleInstallClick} 
            className="absolute bottom-0 left-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            Install App
          </button>
        )}
        <div className="text-center">
            <p className="text-gray-400">Created by CAPTAIN SURI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;