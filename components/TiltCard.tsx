import React, { useRef, useState } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  stepNumber: string;
  title: string;
}

const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', isActive = false, onClick, stepNumber, title }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation (max 10 degrees)
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div 
      className={`perspective-1000 group relative ${className}`} 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div 
        ref={cardRef}
        className={`
          w-full h-[500px] rounded-3xl transition-all duration-200 ease-out preserve-3d border
          flex flex-col relative overflow-hidden bg-slate-900
          ${isActive ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'border-slate-800 shadow-xl hover:border-slate-600'}
        `}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isActive ? 1.02 : 1})`,
        }}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 z-20 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between">
                <span className={`text-5xl font-black italic opacity-20 ${isActive ? 'text-indigo-500' : 'text-slate-500'}`}>
                    {stepNumber}
                </span>
                <div className="text-right">
                    <h3 className="text-xl font-bold tracking-wider">{title}</h3>
                    {isActive && <div className="h-1 w-full bg-indigo-500 rounded-full mt-1 animate-pulse" />}
                </div>
            </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 w-full h-full relative z-10 flex flex-col">
            {children}
        </div>

        {/* Shine Effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-30"
          style={{
            background: `linear-gradient(125deg, transparent 40%, white 50%, transparent 60%)`,
            backgroundSize: '200% 200%',
            backgroundPosition: `${50 + rotate.y * 5}% ${50 + rotate.x * 5}%`
          }}
        />
      </div>
    </div>
  );
};

export default TiltCard;
