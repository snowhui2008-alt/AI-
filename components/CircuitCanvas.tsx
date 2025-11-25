import React, { useEffect, useRef, useState } from 'react';
import { CircuitMode, CircuitState } from '../types';

interface CircuitCanvasProps {
  mode: CircuitMode;
  state: CircuitState;
  simTime: number; // Used to drive animation frame updates for RC values
}

// Helper to draw a resistor zigzag
const ResistorPath = ({ x, y, horizontal = true }: { x: number; y: number; horizontal?: boolean }) => {
  if (horizontal) {
    return <path d={`M ${x} ${y} l 10 0 l 5 -10 l 10 20 l 10 -20 l 10 20 l 10 -20 l 5 10 l 10 0`} fill="none" stroke="currentColor" strokeWidth="2" />;
  }
  return <path d={`M ${x} ${y} l 0 10 l -10 5 l 20 10 l -20 10 l 20 10 l -20 10 l 10 5 l 0 10`} fill="none" stroke="currentColor" strokeWidth="2" />;
};

// Helper to draw a capacitor
const CapacitorPath = ({ x, y, horizontal = true }: { x: number; y: number; horizontal?: boolean }) => {
    if (horizontal) {
        return (
            <g>
                <line x1={x} y1={y} x2={x+30} y2={y} stroke="currentColor" strokeWidth="2" />
                <line x1={x+30} y1={y-15} x2={x+30} y2={y+15} stroke="currentColor" strokeWidth="2" />
                <line x1={x+40} y1={y-15} x2={x+40} y2={y+15} stroke="currentColor" strokeWidth="2" />
                <line x1={x+40} y1={y} x2={x+70} y2={y} stroke="currentColor" strokeWidth="2" />
            </g>
        )
    }
    return (
        <g>
            <line x1={x} y1={y} x2={x} y2={y+30} stroke="currentColor" strokeWidth="2" />
            <line x1={x-15} y1={y+30} x2={x+15} y2={y+30} stroke="currentColor" strokeWidth="2" />
            <line x1={x-15} y1={y+40} x2={x+15} y2={y+40} stroke="currentColor" strokeWidth="2" />
            <line x1={x} y1={y+40} x2={x} y2={y+70} stroke="currentColor" strokeWidth="2" />
        </g>
    )
}

// Helper for Battery
const BatteryPath = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x}, ${y})`}>
    <line x1="0" y1="-20" x2="0" y2="-5" stroke="currentColor" strokeWidth="2" />
    <line x1="-15" y1="-5" x2="15" y2="-5" stroke="currentColor" strokeWidth="2" />
    <line x1="-8" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="4" />
    <line x1="0" y1="5" x2="0" y2="20" stroke="currentColor" strokeWidth="2" />
    <text x="20" y="5" fill="currentColor" className="text-xs font-bold">+</text>
  </g>
);

// Helper for Lightbulb
const Bulb = ({ x, y, brightness }: { x: number; y: number; brightness: number }) => {
  const glowOpacity = Math.min(Math.max(brightness, 0.1), 1);
  const color = `rgba(255, 223, 0, ${glowOpacity})`;
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow effect */}
      <circle cx="0" cy="0" r="25" fill={color} filter="blur(4px)" className="transition-all duration-300" />
      <circle cx="0" cy="0" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="bg-slate-900" />
      <path d="M -8 8 L 0 -5 L 8 8" fill="none" stroke="currentColor" strokeWidth="1" />
    </g>
  );
};

const CircuitCanvas: React.FC<CircuitCanvasProps> = ({ mode, state, simTime }) => {
  // Animation state for electrons
  const [offset, setOffset] = useState(0);
  
  // Physics calculations for visualization
  let current = 0;
  let bulb1Brightness = 0;
  let bulb2Brightness = 0;

  if (state.isSwitchClosed) {
    if (mode === 'series') {
      const Req = state.resistance1 + state.resistance2;
      current = state.voltage / Req;
      bulb1Brightness = (current * state.resistance1) / 10; // Normalize roughly
      bulb2Brightness = (current * state.resistance2) / 10;
    } else if (mode === 'parallel') {
      // Total current
      const I1 = state.voltage / state.resistance1;
      const I2 = state.voltage / state.resistance2;
      current = I1 + I2;
      bulb1Brightness = I1 / 5;
      bulb2Brightness = I2 / 5;
    } else if (mode === 'rc-delay') {
        // RC Series Circuit: Battery -> Switch -> Resistor -> Capacitor -> Back
        // But usually we put a bulb in series to show the current dying out as C charges
        // I(t) = (V/R) * e^(-t/RC)
        const R = state.resistance1; // Use R1 as the main resistor/bulb
        const C = state.capacitance * 1e-6; // convert uF to F
        const tau = R * C; 
        
        // simTime is in seconds roughly (managed by parent or computed here)
        // Note: For visualization, we use the elapsed time since switch closed
        // In this component, we receive a prop or calculate it. 
        // Let's assume simTime is actual seconds switch has been closed.
        
        const instantaneousCurrent = (state.voltage / R) * Math.exp(-simTime / tau);
        current = instantaneousCurrent;
        bulb1Brightness = instantaneousCurrent * 5; // Scaling factor
    }
  }

  // Animation Loop for Electrons
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      // Speed proportional to current, but clamped
      const speed = state.isSwitchClosed ? Math.min(current * 2, 10) : 0; 
      setOffset(prev => (prev - speed) % 1000); // Move negative for conventional flow vs electron flow? 
      // Conventional current: + to -. Electrons: - to +. 
      // Let's visualize Electron flow (real physics): - to + (Counter Clockwise usually in these diagrams)
      // If we want conventional current, move clockwise.
      // Let's do conventional current (Clockwise) -> Positive offset.
      
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [current, state.isSwitchClosed]);

  // Dash array for electron flow visualization
  const strokeDasharray = "10, 10";

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 rounded-xl border border-slate-700 relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

      <svg width="600" height="400" viewBox="0 0 600 400" className="z-10">
        <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                <path d="M0,0 L10,5 L0,10" fill="#fbbf24" />
            </marker>
        </defs>

        {/* --- SERIES MODE --- */}
        {mode === 'series' && (
          <g>
            {/* Main Loop Path */}
            <rect x="100" y="50" width="400" height="300" rx="20" fill="none" stroke="#334155" strokeWidth="4" />
            
            {/* Active Current Path (Overlay) */}
            <rect x="100" y="50" width="400" height="300" rx="20" fill="none" stroke="#fbbf24" strokeWidth="2"
                  strokeDasharray={strokeDasharray} strokeDashoffset={offset} opacity={state.isSwitchClosed ? 1 : 0} />

            {/* Components */}
            <BatteryPath x={100} y={200} /> {/* Left */}
            
            {/* Top Component (R1) */}
            <g transform="translate(300, 50)">
                <foreignObject x="-20" y="-30" width="40" height="60">
                    <div className="flex items-center justify-center h-full text-xs text-slate-400 font-mono">R1</div>
                </foreignObject>
               <Bulb x={0} y={0} brightness={bulb1Brightness} />
            </g>

            {/* Right Component (R2) */}
            <g transform="translate(500, 200)">
                 <foreignObject x="10" y="-10" width="40" height="20">
                    <div className="text-xs text-slate-400 font-mono">R2</div>
                </foreignObject>
                 {/* Rotate for vertical placement look or just symbol */}
                 <ResistorPath x={-35} y={-35} horizontal={false} />
            </g>

            {/* Bottom Switch */}
            <g transform="translate(300, 350)">
              <circle cx="-30" cy="0" r="4" fill="white" />
              <circle cx="30" cy="0" r="4" fill="white" />
              <line x1="-30" y1="0" x2={state.isSwitchClosed ? "30" : "20"} y2={state.isSwitchClosed ? "0" : "-25"} 
                    stroke="white" strokeWidth="3" className="transition-all duration-300" />
               <text x="-15" y="25" fill="white" fontSize="12">开关</text>
            </g>
          </g>
        )}

        {/* --- PARALLEL MODE --- */}
        {mode === 'parallel' && (
          <g>
             {/* Main Outer Loop */}
             <path d="M 100 200 V 50 H 300 H 500 V 200 M 100 200 V 350 H 300 H 500 V 200" 
                   fill="none" stroke="#334155" strokeWidth="4" />
            
             {/* Center Branch */}
             <line x1="300" y1="50" x2="300" y2="350" stroke="#334155" strokeWidth="4" />

             {/* Animation Paths need to be split for parallel visually or simplified */}
             {state.isSwitchClosed && (
                 <>
                    {/* Outer Loop Flow */}
                    <path d="M 100 200 V 50 H 500 V 350 H 100" fill="none" stroke="#fbbf24" strokeWidth="2"
                          strokeDasharray={strokeDasharray} strokeDashoffset={offset} />
                    {/* Inner Branch Flow */}
                    <path d="M 300 50 V 350" fill="none" stroke="#fbbf24" strokeWidth="2"
                          strokeDasharray={strokeDasharray} strokeDashoffset={offset * 0.8} />
                 </>
             )}

             <BatteryPath x={100} y={200} />
             
             {/* Branch 1 (Center) */}
             <g transform="translate(300, 200)">
                <ResistorPath x={-35} y={-35} horizontal={false} />
                <text x="15" y="0" fill="#94a3b8" fontSize="12">R1</text>
             </g>

             {/* Branch 2 (Right) */}
             <g transform="translate(500, 200)">
                <Bulb x={0} y={0} brightness={bulb2Brightness} />
                <text x="20" y="0" fill="#94a3b8" fontSize="12">R2 (灯泡)</text>
             </g>

             {/* Switch (Master) at bottom left before split */}
             <g transform="translate(200, 350)">
                 <circle cx="-20" cy="0" r="4" fill="white" />
                 <circle cx="20" cy="0" r="4" fill="white" />
                 <line x1="-20" y1="0" x2={state.isSwitchClosed ? "20" : "15"} y2={state.isSwitchClosed ? "0" : "-20"} 
                    stroke="white" strokeWidth="3" className="transition-all duration-300" />
             </g>
          </g>
        )}

        {/* --- RC DELAY MODE --- */}
        {mode === 'rc-delay' && (
          <g>
            <rect x="100" y="50" width="400" height="300" rx="20" fill="none" stroke="#334155" strokeWidth="4" />
            
            <rect x="100" y="50" width="400" height="300" rx="20" fill="none" stroke="#fbbf24" strokeWidth="2"
                  strokeDasharray={strokeDasharray} strokeDashoffset={offset} opacity={state.isSwitchClosed ? Math.min(current, 1) : 0} />

            <BatteryPath x={100} y={200} />

            {/* Resistor/Bulb at Top */}
            <g transform="translate(300, 50)">
               <Bulb x={0} y={0} brightness={bulb1Brightness} />
               <text x="-15" y="-25" fill="#94a3b8" fontSize="12">灯泡 (R)</text>
            </g>

            {/* Capacitor at Right */}
            <g transform="translate(500, 200)">
                <CapacitorPath x={0} y={-35} horizontal={false} />
                <text x="20" y="0" fill="#94a3b8" fontSize="12">C</text>
                {/* Charge Visualization */}
                <rect x="-15" y="-35" width="30" height="70" fill="rgba(59, 130, 246, 0.3)" 
                      style={{ clipPath: 'inset(0 0 0 0)'}} // Simplified logic
                      /> 
                <text x="25" y="20" fill="#60a5fa" fontSize="10">
                    {(state.voltage * (1 - Math.exp(-simTime / (state.resistance1 * state.capacitance * 1e-6)))).toFixed(1)}V
                </text>
            </g>

             {/* Switch */}
             <g transform="translate(300, 350)">
                <circle cx="-30" cy="0" r="4" fill="white" />
                <circle cx="30" cy="0" r="4" fill="white" />
                <line x1="-30" y1="0" x2={state.isSwitchClosed ? "30" : "20"} y2={state.isSwitchClosed ? "0" : "-25"} 
                    stroke="white" strokeWidth="3" className="transition-all duration-300" />
                 <text x="-15" y="25" fill="white" fontSize="12">开关</text>
            </g>
          </g>
        )}
      </svg>
      
      {/* Overlay Stats */}
      <div className="absolute top-4 left-4 bg-slate-900/80 p-2 rounded border border-slate-700 text-xs font-mono">
        <div>总电流 I: {current.toFixed(3)} A</div>
        {mode === 'rc-delay' && <div>时间 t: {simTime.toFixed(2)} s</div>}
      </div>
    </div>
  );
};

export default CircuitCanvas;