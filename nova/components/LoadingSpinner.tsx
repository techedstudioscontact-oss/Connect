
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8';
  return (
    <div className={`animate-spin rounded-full ${sizeClass} border-b-2 border-sky-500`}></div>
  );
};