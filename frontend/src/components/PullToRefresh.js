import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({ onRefresh, children }) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  
  const THRESHOLD = 80; // Minimum pull distance to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!startY.current || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault();
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);
      setIsPulling(true);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
    setIsPulling(false);
    startY.current = 0;
    currentY.current = 0;
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = progress * 180;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center z-30 transition-opacity duration-200"
        style={{
          top: 0,
          height: `${pullDistance}px`,
          opacity: isPulling || isRefreshing ? 1 : 0,
        }}
      >
        <div
          className={`p-2 rounded-full bg-white shadow-lg transition-transform duration-200 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
          }}
        >
          <RefreshCw
            className={`w-5 h-5 transition-colors ${
              progress >= 1 ? 'text-primary' : 'text-gray-400'
            }`}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isPulling ? `translateY(${pullDistance}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.3s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
