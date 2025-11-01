
import React from 'react';
import { GroundingSource } from '../types.ts';

interface GroundingSourcesDisplayProps {
  sources: GroundingSource[];
}

export const GroundingSourcesDisplay: React.FC<GroundingSourcesDisplayProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-500 pt-2">
      <h4 className="text-xs font-semibold text-gray-300 mb-1 uppercase tracking-wider">Sources:</h4>
      <ul className="space-y-1">
        {sources.map((source, index) => (
          <li key={index} className="truncate">
            <a
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline transition-colors"
              title={source.title}
            >
              {source.title || source.uri}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};