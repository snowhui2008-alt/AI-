import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface FullscreenViewerProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ 
  isOpen, 
  imageUrl, 
  onClose,
  onNext,
  onPrev
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNext, onPrev, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Calculate new scale
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 5); // Limit zoom between 0.5x and 5x
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if left click and not clicking buttons
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center overflow-hidden">
      {/* Controls Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="text-white/70 text-sm font-mono pointer-events-auto bg-black/40 px-3 py-1 rounded-full backdrop-blur hidden md:block">
          鼠标滚轮缩放 • 拖拽移动 • 键盘左右切换
        </div>
        <div className="flex items-center gap-4 pointer-events-auto ml-auto">
          <button onClick={resetView} className="p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors" title="重置视角">
            <RotateCcw size={20} />
          </button>
          <button onClick={onClose} className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors flex items-center gap-2 px-4 shadow-lg shadow-indigo-900/50">
             <X size={20} />
             <span className="font-bold">还原界面</span>
          </button>
        </div>
      </div>

      {/* Navigation Buttons (Left) */}
      {onPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-all hover:scale-110"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Navigation Buttons (Right) */}
      {onNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-all hover:scale-110"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Image Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center cursor-move active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={imageUrl} 
          alt="Fullscreen Preview"
          className="max-w-none transition-transform duration-200 ease-out select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            maxHeight: '90vh',
            maxWidth: '90vw'
          }}
          draggable={false}
        />
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-white/90 text-sm font-mono pointer-events-none border border-white/10">
        {(scale * 100).toFixed(0)}%
      </div>
    </div>
  );
};

export default FullscreenViewer;