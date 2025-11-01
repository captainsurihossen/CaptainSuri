import React from 'react';

const suggestions = [
  'Tell me a story about a dragon',
  'Generate an image of a robot chef',
  'Search for the latest news on AI',
];

export const SuggestionChips: React.FC = () => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 mb-4">
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((text, index) => (
          <div key={index} className="bg-gray-800/60 border border-cyan-500/20 text-cyan-200 text-sm px-3 py-1 rounded-full cursor-default animate-fade-in">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
};
