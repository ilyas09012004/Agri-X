import React from 'react';

// --- Card Component ---
interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

// --- Badge Component ---
interface BadgeProps {
  variant?: 'success' | 'default';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children }) => {
  const baseClass = 'inline-block px-2 py-1 text-xs font-semibold rounded-full';
  const variantClass = variant === 'success' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  return <span className={`${baseClass} ${variantClass}`}>{children}</span>;
};

// --- Button Component ---
interface ButtonProps {
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ onClick, variant = 'primary', className = '', children }) => {
  const baseClass = 'px-4 py-2 rounded-md font-medium transition-colors';
  const variantClass = variant === 'primary' ? 'bg-agri-green hover:bg-green-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800';
  return (
    <button onClick={onClick} className={`${baseClass} ${variantClass} ${className}`}>
      {children}
    </button>
  );
};