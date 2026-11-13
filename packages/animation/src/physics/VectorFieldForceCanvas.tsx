import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface ForceVector {
  label: string; // e.g. "F_Lorentz", "P = mg", "F_đẩy"
  color: string;
  angleDeg: number; // 0 = right, 90 = down, 180 = left, 270 = up
  magnitude: number; // pixel length
}

export interface VectorFieldForceProps {
  objectType?: 'box' | 'sphere' | 'pendulum' | 'coil' | 'projectile' | 'car' | 'apple' | 'submarine' | 'skater';
  motionModel?: 'static' | 'oscillatory' | 'projectile';
  forces?: ForceVector[];
  formula?: string;
  gravityMps2?: number;
  initialSpeedMps?: number;
  launchAngleDeg?: number;
  pendulumLengthM?: number;
  periodSeconds?: number;
  width?: number;
  height?: number;
}

/**
 * VectorFieldForceCanvas
 * Classical mechanics & electromagnetic force simulator.
 * Dynamically renders free-body force vectors with animated arrows, labels, and coordinate planes.
 */
export const VectorFieldForceCanvas: React.FC<VectorFieldForceProps> = ({
  objectType = 'box',
  motionModel = 'static',
  forces = [
    { label: 'F_Lorentz', color: '#EF4444', angleDeg: 0, magnitude: 150 },
    { label: 'P = mg', color: '#38BDF8', angleDeg: 90, magnitude: 120 },
    { label: 'N', color: '#FBBF24', angleDeg: 270, magnitude: 120 },
    { label: 'F_ms', color: '#A855F7', angleDeg: 180, magnitude: 80 }
  ],
  formula = 'F = I(L × B)',
  gravityMps2 = 9.8,
  initialSpeedMps = 18,
  launchAngleDeg = 45,
  pendulumLengthM = 1,
  periodSeconds = 2.01,
  width = 840,
  height = 460
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const baseCenterX = width / 2;
  const baseCenterY = height / 2;

  // Gentle floating oscillation
  const bobY = motionModel === 'static' ? Math.sin(frame / 12) * 6 : 0;
  const launchRadians = launchAngleDeg * Math.PI / 180;
  const flightSeconds = 2 * initialSpeedMps * Math.sin(launchRadians) / gravityMps2;
  const flightProgress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const flightTime = flightProgress * flightSeconds;
  const rangeMeters = initialSpeedMps * Math.cos(launchRadians) * flightSeconds;
  const maxHeightMeters = Math.pow(initialSpeedMps * Math.sin(launchRadians), 2) / (2 * gravityMps2);
  const projectileX = 80 + (initialSpeedMps * Math.cos(launchRadians) * flightTime / rangeMeters) * (width - 160);
  const projectileHeight = initialSpeedMps * Math.sin(launchRadians) * flightTime - 0.5 * gravityMps2 * flightTime * flightTime;
  const projectileY = height - 85 - (projectileHeight / Math.max(1, maxHeightMeters)) * (height - 180);
  const pendulumAngle = 0.55 * Math.cos((2 * Math.PI * frame) / Math.max(1, periodSeconds * fps));
  const pendulumPixels = Math.min(175, 120 + pendulumLengthM * 35);
  const pendulumX = baseCenterX + Math.sin(pendulumAngle) * pendulumPixels;
  const pendulumY = 60 + Math.cos(pendulumAngle) * pendulumPixels;
  const isProjectile = objectType === 'projectile' || motionModel === 'projectile';
  const isPendulum = objectType === 'pendulum' || motionModel === 'oscillatory';
  const isCar = objectType === 'car' || (objectType === 'box' && forces.some(f => /phanh|hãm|xe|km\/h/i.test(f.label)));
  const isApple = objectType === 'apple' || forces.some(f => /táo|apple/i.test(f.label));
  const isSubmarine = objectType === 'submarine' || forces.some(f => /tàu|sub|ác-si-mét/i.test(f.label));
  const isSkater = objectType === 'skater' || forces.some(f => /trượt|băng|skate/i.test(f.label));
  const isRealWorldElement = isCar || isApple || isSubmarine || isSkater;
  const centerX = isProjectile ? projectileX : isPendulum ? pendulumX : baseCenterX;
  const centerY = isProjectile ? projectileY : isPendulum ? pendulumY : baseCenterY;

  const trajectory = Array.from({ length: 49 }, (_, index) => {
    const t = (index / 48) * flightSeconds;
    const x = 80 + (initialSpeedMps * Math.cos(launchRadians) * t / rangeMeters) * (width - 160);
    const yMeters = initialSpeedMps * Math.sin(launchRadians) * t - 0.5 * gravityMps2 * t * t;
    const y = height - 85 - (yMeters / Math.max(1, maxHeightMeters)) * (height - 180);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div style={{ position: 'relative', width, height, margin: '0 auto' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="vectorGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="objectNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="24" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="bodyMetallicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="neonCyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="1" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="impulseRipple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="headlightBeam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="appleRedGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="60%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </radialGradient>
        </defs>

        {isProjectile && <>
          <path d={trajectory} fill="none" stroke="rgba(56,189,248,.5)" strokeWidth="4" strokeDasharray="10 10" />
          <line x1="65" y1={height - 84} x2={width - 65} y2={height - 84} stroke="rgba(148,163,184,.4)" strokeWidth="3" />
        </>}

        {isPendulum && <>
          <path d={`M ${baseCenterX - pendulumPixels} 60 A ${pendulumPixels} ${pendulumPixels} 0 0 0 ${baseCenterX + pendulumPixels} 60`} fill="none" stroke="rgba(56,189,248,.25)" strokeWidth="3" strokeDasharray="8 8" />
          <line x1={baseCenterX} y1="60" x2={centerX} y2={centerY} stroke="#CBD5E1" strokeWidth="6" />
          <circle cx={baseCenterX} cy="60" r="10" fill="#FBBF24" />
        </>}

        {/* Coordinate Reference Crosshair */}
        <line
          x1={centerX - 240}
          y1={centerY + bobY}
          x2={centerX + 240}
          y2={centerY + bobY}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <line
          x1={centerX}
          y1={centerY - 160 + bobY}
          x2={centerX}
          y2={centerY + 160 + bobY}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Pulsing Energy Aura around physical object */}
        <circle
          cx={centerX}
          cy={centerY + bobY}
          r={isProjectile ? 52 : 72}
          fill="url(#impulseRipple)"
          opacity={0.35 + Math.sin(frame / 6) * 0.15}
        />

        {/* Central Physical Object with High-End Cyberpunk / Real-World Aesthetics */}
        {isCar && (
          <g transform={`translate(${centerX}, ${centerY + bobY})`}>
            {/* Ground Asphalt Line with animated road dash marks */}
            <line x1="-280" y1="36" x2="280" y2="36" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="3" />
            <line x1="-280" y1="36" x2="280" y2="36" stroke="#38BDF8" strokeWidth="2" strokeDasharray="16 20" strokeDashoffset={(-frame * 8) % 36} opacity="0.6" />

            {/* Headlight beam shining forward */}
            <polygon points="76,4 260,-24 260,34 76,14" fill="url(#headlightBeam)" opacity="0.4" />

            {/* Rear brake light aura when braking force is active */}
            {forces.some(f => /phanh|hãm/i.test(f.label)) && (
              <g>
                <circle cx="-76" cy="6" r="22" fill="#EF4444" opacity="0.5" filter="url(#vectorGlow)" />
                <circle cx="-52" cy="30" r="12" fill="rgba(239, 68, 68, 0.3)" filter="url(#vectorGlow)" />
                <circle cx="36" cy="30" r="10" fill="rgba(239, 68, 68, 0.25)" filter="url(#vectorGlow)" />
              </g>
            )}

            {/* Streamlined Car Aerodynamic Outer Body */}
            <path
              d="M -75,24 L -72,-2 Q -55,-6 -40,-24 L 8,-24 Q 28,-24 46,-6 L 76,-2 Q 80,4 78,24 L 62,24 A 18 18 0 0 0 26,24 L -30,24 A 18 18 0 0 0 -66,24 Z"
              fill="url(#bodyMetallicGrad)"
              stroke="#38BDF8"
              strokeWidth="3.5"
              filter="url(#objectNeonGlow)"
            />

            {/* Cockpit Windshield (Glassmorphic) */}
            <path
              d="M -34,-20 L 4,-20 Q 22,-20 36,-6 L -16,-6 Z"
              fill="rgba(56, 189, 248, 0.35)"
              stroke="#38BDF8"
              strokeWidth="2"
            />

            {/* Inertia Passenger Silhouette (Tilting forward to demonstrate inertia) */}
            <g transform={`translate(-6, -10) rotate(${forces.some(f => /phanh|hãm/i.test(f.label)) ? Math.sin(frame / 6) * 12 + 10 : 0})`}>
              <circle cx="0" cy="-6" r="6" fill="#38BDF8" />
              <path d="M -4,2 Q 0,-2 4,2 L 6,14 L -6,14 Z" fill="rgba(56, 189, 248, 0.8)" />
            </g>

            {/* Headlight bulb */}
            <circle cx="76" cy="6" r="4" fill="#FDE047" filter="url(#vectorGlow)" />
            {/* Brake tail light */}
            <rect x="-76" y="2" width="6" height="8" rx="2" fill="#EF4444" filter="url(#vectorGlow)" />

            {/* Rear Alloy Wheel */}
            <g transform="translate(-48, 24)">
              <circle cx="0" cy="0" r="17" fill="#020617" stroke="#38BDF8" strokeWidth="3" />
              <circle cx="0" cy="0" r="10" fill="#1E293B" stroke="#818CF8" strokeWidth="2" />
              <circle cx="0" cy="0" r="4" fill="#38BDF8" />
              <line x1="-10" y1="0" x2="10" y2="0" stroke="#38BDF8" strokeWidth="2" transform={`rotate(${frame * 14})`} />
              <line x1="0" y1="-10" x2="0" y2="10" stroke="#38BDF8" strokeWidth="2" transform={`rotate(${frame * 14})`} />
            </g>

            {/* Front Alloy Wheel */}
            <g transform="translate(44, 24)">
              <circle cx="0" cy="0" r="17" fill="#020617" stroke="#38BDF8" strokeWidth="3" />
              <circle cx="0" cy="0" r="10" fill="#1E293B" stroke="#818CF8" strokeWidth="2" />
              <circle cx="0" cy="0" r="4" fill="#38BDF8" />
              <line x1="-10" y1="0" x2="10" y2="0" stroke="#38BDF8" strokeWidth="2" transform={`rotate(${frame * 14})`} />
              <line x1="0" y1="-10" x2="0" y2="10" stroke="#38BDF8" strokeWidth="2" transform={`rotate(${frame * 14})`} />
            </g>
          </g>
        )}

        {isApple && (
          <g transform={`translate(${centerX}, ${centerY + bobY})`}>
            {/* Apple Silhouette with glossy gradient */}
            <path
              d="M 0,-24 C 20,-38 46,-16 40,16 C 34,42 14,46 0,40 C -14,46 -34,42 -40,16 C -46,-16 -20,-38 0,-24 Z"
              fill="url(#appleRedGrad)"
              stroke="#F87171"
              strokeWidth="3"
              filter="url(#objectNeonGlow)"
            />
            {/* Glossy Reflection Highlight */}
            <path
              d="M -22,-14 C -14,-24 -2,-26 6,-24 C -2,-20 -10,-10 -16,-2 Z"
              fill="#FFFFFF"
              opacity="0.45"
            />
            {/* Wooden Stem */}
            <path
              d="M 0,-24 Q 4,-38 12,-44"
              fill="none"
              stroke="#78350F"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Emerald Leaf */}
            <path
              d="M 6,-36 Q 24,-48 30,-34 Q 24,-24 6,-36 Z"
              fill="#10B981"
              stroke="#059669"
              strokeWidth="2"
            />
          </g>
        )}

        {isSubmarine && (
          <g transform={`translate(${centerX}, ${centerY + bobY})`}>
            {/* Sonar Ping Rings */}
            <circle cx="70" cy="0" r={(frame * 3) % 45} fill="none" stroke="#10B981" strokeWidth="2" opacity={1 - ((frame * 3) % 45) / 45} />
            <circle cx="70" cy="0" r={((frame * 3) + 20) % 45} fill="none" stroke="#10B981" strokeWidth="2" opacity={1 - (((frame * 3) + 20) % 45) / 45} />

            {/* Rising Air Bubbles */}
            <circle cx="-30" cy={-25 - ((frame * 2) % 60)} r="4" fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" />
            <circle cx="-15" cy={-20 - (((frame * 2) + 30) % 60)} r="3" fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.5" />
            <circle cx="20" cy={-30 - (((frame * 2) + 15) % 60)} r="5" fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.7" />

            {/* Submarine Hull */}
            <path
              d="M -75,0 C -75,-26 35,-26 65,-10 C 78,0 78,0 65,10 C 35,26 -75,26 -75,0 Z"
              fill="url(#bodyMetallicGrad)"
              stroke="#38BDF8"
              strokeWidth="3.5"
              filter="url(#objectNeonGlow)"
            />

            {/* Conning Tower & Periscope */}
            <rect x="-16" y="-36" width="30" height="14" rx="4" fill="url(#bodyMetallicGrad)" stroke="#38BDF8" strokeWidth="2" />
            <line x1="-4" y1="-36" x2="-4" y2="-48" stroke="#38BDF8" strokeWidth="3" />
            <line x1="-4" y1="-48" x2="6" y2="-48" stroke="#FBBF24" strokeWidth="3" />

            {/* Illuminated Portholes (3 Glowing Windows) */}
            <circle cx="-32" cy="0" r="6" fill="#38BDF8" opacity="0.8" filter="url(#vectorGlow)" />
            <circle cx="-8" cy="0" r="6" fill="#38BDF8" opacity="0.8" filter="url(#vectorGlow)" />
            <circle cx="16" cy="0" r="6" fill="#38BDF8" opacity="0.8" filter="url(#vectorGlow)" />

            {/* Rear Propeller (Spinning) */}
            <line x1="-75" y1="-14" x2="-75" y2="14" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" transform={`rotate(${frame * 24}, -75, 0)`} />
          </g>
        )}

        {isSkater && (
          <g transform={`translate(${centerX}, ${centerY + bobY})`}>
            {/* Ice Surface Line */}
            <line x1="-240" y1="36" x2="240" y2="36" stroke="#93C5FD" strokeWidth="3" opacity="0.7" />
            {/* Ice spray particles */}
            <circle cx="-40" cy="34" r="3" fill="#BAE6FD" />
            <circle cx="-55" cy="30" r="2.5" fill="#BAE6FD" />
            <circle cx="-65" cy="24" r="2" fill="#BAE6FD" />

            {/* Skate Boot & Chrome Blade */}
            <path
              d="M -24,24 L -16,-10 Q -10,-24 8,-20 L 26,-8 L 32,18 L -14,24 Z"
              fill="url(#bodyMetallicGrad)"
              stroke="#38BDF8"
              strokeWidth="3"
            />
            {/* Chrome Blade */}
            <line x1="-34" y1="34" x2="42" y2="34" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" filter="url(#vectorGlow)" />
            <line x1="-18" y1="24" x2="-18" y2="34" stroke="#CBD5E1" strokeWidth="3" />
            <line x1="22" y1="24" x2="22" y2="34" stroke="#CBD5E1" strokeWidth="3" />
          </g>
        )}

        {/* Fallback to Geometric Physics Objects when not a real-world element */}
        {!isRealWorldElement && (objectType === 'sphere' || objectType === 'projectile' || objectType === 'pendulum') && (
          <g>
            {/* Outer Neon Glow Ring */}
            <circle
              cx={centerX}
              cy={centerY + bobY}
              r={isProjectile ? 32 : 50}
              fill="none"
              stroke="url(#neonCyanGlow)"
              strokeWidth="4"
              filter="url(#objectNeonGlow)"
            />
            {/* Main Body */}
            <circle
              cx={centerX}
              cy={centerY + bobY}
              r={isProjectile ? 28 : 44}
              fill="url(#bodyMetallicGrad)"
              stroke="#38BDF8"
              strokeWidth="3.5"
            />
            {/* Inner Sci-Fi Core */}
            <circle
              cx={centerX}
              cy={centerY + bobY}
              r={isProjectile ? 14 : 22}
              fill="none"
              stroke="#818CF8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </g>
        )}
        {!isRealWorldElement && objectType === 'box' && (
          <g>
            {/* Outer Neon Glow */}
            <rect
              x={centerX - 52}
              y={centerY - 52 + bobY}
              width="104"
              height="104"
              rx="18"
              fill="none"
              stroke="url(#neonCyanGlow)"
              strokeWidth="4"
              filter="url(#objectNeonGlow)"
            />
            {/* Main Metallic Body */}
            <rect
              x={centerX - 46}
              y={centerY - 46 + bobY}
              width="92"
              height="92"
              rx="14"
              fill="url(#bodyMetallicGrad)"
              stroke="#38BDF8"
              strokeWidth="3"
            />
            {/* Inner Tech Lines */}
            <rect
              x={centerX - 30}
              y={centerY - 30 + bobY}
              width="60"
              height="60"
              rx="8"
              fill="rgba(56, 189, 248, 0.08)"
              stroke="#818CF8"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            {/* Tech Corner Crosses */}
            <circle cx={centerX - 36} cy={centerY - 36 + bobY} r="2.5" fill="#38BDF8" />
            <circle cx={centerX + 36} cy={centerY - 36 + bobY} r="2.5" fill="#38BDF8" />
            <circle cx={centerX - 36} cy={centerY + 36 + bobY} r="2.5" fill="#38BDF8" />
            <circle cx={centerX + 36} cy={centerY + 36 + bobY} r="2.5" fill="#38BDF8" />
          </g>
        )}
        {!isRealWorldElement && objectType === 'coil' && (
          <g transform={`translate(${centerX - 48}, ${centerY - 48 + bobY})`}>
            <circle cx="48" cy="48" r="46" fill="url(#bodyMetallicGrad)" stroke="#FBBF24" strokeWidth="6" filter="url(#objectNeonGlow)" />
            <circle cx="48" cy="48" r="30" fill="#0F172A" stroke="#EF4444" strokeWidth="3" strokeDasharray="8 4" />
            <circle cx="48" cy="48" r="14" fill="#FBBF24" opacity="0.8" />
          </g>
        )}

        {/* Center of Mass Core Spark */}
        <circle cx={centerX} cy={centerY + bobY} r="7" fill="#FFFFFF" filter="url(#vectorGlow)" />
        <circle cx={centerX} cy={centerY + bobY} r="3" fill="#38BDF8" />

        {/* Dynamic Force Vectors with animated particle trail */}
        {forces.map((f, i) => {
          const isTensionVector = isPendulum && /t(\s|_|$)|dây|tension/i.test(f.label);
          const rad = isTensionVector
            ? Math.atan2(60 - centerY, baseCenterX - centerX)
            : (f.angleDeg * Math.PI) / 180;
          const targetX = centerX + Math.cos(rad) * f.magnitude;
          const targetY = centerY + bobY + Math.sin(rad) * f.magnitude;

          // Arrowhead points
          const headLen = 16;
          const arrowAngle1 = rad + Math.PI * 0.85;
          const arrowAngle2 = rad - Math.PI * 0.85;
          const h1x = targetX + Math.cos(arrowAngle1) * headLen;
          const h1y = targetY + Math.sin(arrowAngle1) * headLen;
          const h2x = targetX + Math.cos(arrowAngle2) * headLen;
          const h2y = targetY + Math.sin(arrowAngle2) * headLen;

          // Animated energy photon flowing along the force vector
          const photonT = ((frame * 0.04 + i * 0.25) % 1);
          const photonX = centerX + Math.cos(rad) * (f.magnitude * photonT);
          const photonY = centerY + bobY + Math.sin(rad) * (f.magnitude * photonT);

          // Label placement offset
          const labelDist = f.magnitude + 28;
          const lx = centerX + Math.cos(rad) * labelDist;
          const ly = centerY + bobY + Math.sin(rad) * labelDist;

          return (
            <g key={i}>
              {/* Vector Background Glow Line */}
              <line
                x1={centerX}
                y1={centerY + bobY}
                x2={targetX}
                y2={targetY}
                stroke={f.color}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.3"
                filter="url(#vectorGlow)"
              />
              {/* Main Vector Shaft */}
              <line
                x1={centerX}
                y1={centerY + bobY}
                x2={targetX}
                y2={targetY}
                stroke={f.color}
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#vectorGlow)"
              />
              {/* Flowing Energy Pulse on Vector */}
              <circle
                cx={photonX}
                cy={photonY}
                r="4.5"
                fill="#FFFFFF"
                filter="url(#vectorGlow)"
              />
              {/* Arrowhead */}
              <polygon
                points={`${targetX},${targetY} ${h1x},${h1y} ${h2x},${h2y}`}
                fill={f.color}
                filter="url(#vectorGlow)"
              />
              {/* High-Contrast Badge for Vector Text Label */}
              <rect
                x={lx - 46}
                y={ly - 18}
                width="92"
                height="36"
                rx="10"
                fill="rgba(15, 23, 42, 0.85)"
                stroke={f.color}
                strokeWidth="1.5"
                filter="url(#vectorGlow)"
              />
              <text
                x={lx}
                y={ly + 7}
                fill={f.color}
                fontSize="20"
                fontWeight="900"
                textAnchor="middle"
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Governing Formula in lower left */}
        {formula && (
          <text
            x={20}
            y={height - 20}
            fill="#FBBF24"
            fontSize="26"
            fontWeight="900"
            textAnchor="start"
          >
            {formula}
          </text>
        )}
      </svg>
    </div>
  );
};

