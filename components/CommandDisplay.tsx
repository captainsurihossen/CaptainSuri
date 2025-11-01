
import React from 'react';
import { FunctionCallInfo } from '../types.ts';

interface CommandDisplayProps {
  functionCall: FunctionCallInfo | null;
}

export const CommandDisplay: React.FC<CommandDisplayProps> = ({ functionCall }) => {
  if (!functionCall) return null;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-lg p-4 w-full max-w-md mx-auto animate-fade-in">
      <h3 className="text-cyan-400 font-semibold text-sm mb-2 uppercase tracking-wider">Command Recognized</h3>
      <div className="bg-black/30 rounded p-3 font-mono text-sm">
        <p><span className="text-pink-400">{functionCall.name}</span><span className="text-gray-400">(</span></p>
        <div className="pl-4">
          {Object.entries(functionCall.args).map(([key, value]) => (
            <p key={key}>
              <span className="text-sky-300">{key}</span>: <span className="text-orange-300">{JSON.stringify(value)}</span>,
            </p>
          ))}
        </div>
        <p><span className="text-gray-400">)</span></p>
      </div>
    </div>
  );
};