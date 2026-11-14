import React from 'react';
import { useCurrentFrame } from 'remotion';
import { WaveOscillationCanvas } from './WaveOscillationCanvas';
import { ParticleKineticCanvas } from './ParticleKineticCanvas';
import { VectorFieldForceCanvas } from './VectorFieldForceCanvas';

export interface GenericPhysicsSceneProps {
  title?: string;
  badge?: string;
  category?: 'wave' | 'thermal' | 'mechanics' | 'optics';
  subtitle?: string;
  highlightWords?: string[];
  formula?: string;
}

/**
 * GenericPhysicsCanvas
 * Universal adaptive layout engine matching the exact 9:16 vertical design DNA:
 * - Persistent header with category pill
 * - Bold 58px hook title with keyword highlights
 * - Central interactive physics canvas (Wave / Kinetic Particles / Vector Forces)
 * - 2-line bottom insight summary
 */
export const GenericPhysicsCanvas: React.FC<GenericPhysicsSceneProps> = ({
  title = 'Nguyên lý dao động sóng & trường lực',
  badge = 'VẬT LÝ ĐẠI CƯƠNG',
  category = 'wave',
  subtitle = 'Năng lượng lan truyền theo hàm sin tuần hoàn\n→ tạo thành sóng dừng và cộng hưởng',
  highlightWords = ['dao động', 'sóng', 'cộng hưởng'],
  formula = 'y = A·sin(ωt - kx)'
}) => {
  const frame = useCurrentFrame();

  const highlightText = (text: string, words: string[]) => {
    let result: React.ReactNode = text;
    for (const w of words) {
      if (typeof result === 'string' && result.includes(w)) {
        const parts: string[] = result.split(w);
        result = (
          <>
            {parts[0]}
            <span style={{ color: '#FBBF24' }}>{w}</span>
            {parts[1]}
          </>
        );
      }
    }
    return result;
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#070B14',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#38BDF8',
              boxShadow: '0 0 10px #38BDF8'
            }}
          />
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.08em', color: '#F8FAFC' }}>
            VẬT LÝ với LuminaLearn
          </span>
        </div>
        <div
          style={{
            border: '2px solid rgba(56, 189, 248, 0.4)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            padding: '8px 22px',
            borderRadius: 9999,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#38BDF8'
          }}
        >
          {badge}
        </div>
      </div>

      {/* 2. Title Section */}
      <div style={{ position: 'absolute', top: 240, left: 90, right: 90 }}>
        <div style={{ color: '#FFFFFF', fontSize: 56, fontWeight: 900, lineHeight: 1.25 }}>
          {highlightText(title, highlightWords)}
        </div>
      </div>

      {/* 3. Central Simulation Canvas */}
      <div
        style={{
          position: 'absolute',
          top: 480,
          left: 80,
          right: 80,
          height: 640,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {category === 'wave' && (
          <WaveOscillationCanvas
            amplitude={85}
            frequency={3.2}
            speed={4.5}
            color="#38BDF8"
            phaseLabel={formula}
          />
        )}
        {category === 'thermal' && (
          <ParticleKineticCanvas
            particleCount={32}
            temperature="medium"
            phase="gas"
          />
        )}
        {category === 'mechanics' && (
          <VectorFieldForceCanvas
            objectType="box"
            formula={formula}
          />
        )}
      </div>

      {/* 4. Bottom Insight Caption */}
      <div
        style={{
          position: 'absolute',
          bottom: 280,
          left: 90,
          right: 90
        }}
      >
        <div style={{ color: '#F8FAFC', fontSize: 36, fontWeight: 700, lineHeight: 1.45 }}>
          {subtitle.split('\n').map((line, i) => (
            <div key={i}>{highlightText(line, highlightWords)}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
