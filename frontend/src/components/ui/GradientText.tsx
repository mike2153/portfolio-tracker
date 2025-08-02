import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
}

export default function GradientText({ children, className = '' }: GradientTextProps) {
  return (
    <span 
      className={className}
      style={{
        background: 'linear-gradient(90deg, #8A2BE2 0%, #4B3CFA 50%, #4FC3F7 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </span>
  );
}