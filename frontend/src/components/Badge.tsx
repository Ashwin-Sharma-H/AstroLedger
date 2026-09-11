import React from 'react';

export type BadgeVariant = 'gold' | 'emerald' | 'mystic' | 'subtle' | 'rose';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}


export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gold',
  className = '',
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
};
