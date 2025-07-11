import React from 'react';
import { twMerge } from 'tailwind-merge';

type LogoProps = {
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  className = ''
}: LogoProps) => {
  return (
    <h1
    style={{
        fontFamily: 'RubikDirt, sans-serif',
      }}
      className={twMerge('text-[#FF7F50] text-3xl', className)}
    >
        browsly
    </h1>
  );
};

export default Logo;
