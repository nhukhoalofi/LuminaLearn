import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import { SPECTRUM_BANDS } from './physics-types';
import { PrismDispersion } from './PrismDispersion';
import { RaindropRefraction } from './RaindropRefraction';
import { InternalReflection } from './InternalReflection';
import { RainbowFormation } from './RainbowFormation';
import { PhysicsCameraTransitions } from './PhysicsCameraTransitions';

export interface RainbowSubtitleCue {
  id: string;
  startFrame: number;
  endFrame: number;
  text: string;
}

export const RAINBOW_DEMO_SUBTITLES: RainbowSubtitleCue[] = [
  {
    id: 'cue_1',
    startFrame: 15,
    endFrame: 225,
    text: 'Vì sao sau mỗi cơn mưa rào, trên bầu trời lại xuất hiện dải cầu vồng rực rỡ?'
  },
  {
    id: 'cue_2',
    startFrame: 255,
    endFrame: 525,
    text: 'Ánh sáng trắng Mặt Trời là tập hợp 7 sắc màu; khi qua môi trường trong suốt, mỗi màu bị bẻ cong một góc khác nhau.'
  },
  {
    id: 'cue_3',
    startFrame: 555,
    endFrame: 885,
    text: 'Mỗi giọt nước mưa là một lăng kính tí hon. Khi ánh sáng đi vào, hiện tượng khúc xạ phân tách các màu sắc.'
  },
  {
    id: 'cue_4',
    startFrame: 915,
    endFrame: 1215,
    text: 'Khi chạm thành sau của giọt nước, tia sáng phản xạ trong, dội ngược về mặt trước phía dưới.'
  },
  {
    id: 'cue_5',
    startFrame: 1245,
    endFrame: 1545,
    text: 'Khi thoát ra ngoài, tia đỏ lệch ở góc 42°, còn tia tím lệch ở góc 40° so với hướng ánh sáng tới.'
  },
  {
    id: 'cue_6',
    startFrame: 1575,
    endFrame: 1785,
    text: 'Hàng triệu giọt mưa cùng hội tụ các tia sáng vào mắt bạn, tạo nên dải cầu vồng tuyệt đẹp!'
  }
];

export interface RainbowFullSceneProps {
  subtitlesEnabled?: boolean;
}

export const RainbowFullScene: React.FC<RainbowFullSceneProps> = ({
  subtitlesEnabled = true
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Find active subtitle
  const activeCue = RAINBOW_DEMO_SUBTITLES.find(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );

  // Background ambient animation
  const bgHue = interpolate(frame, [0, durationInFrames], [222, 230]);
  const progressRatio = Math.min(1, Math.max(0, frame / durationInFrames));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#090D16',
        backgroundImage: `radial-gradient(circle at 50% 20%, hsl(${bgHue}, 45%, 15%) 0%, #060911 100%)`,
        color: '#F8FAFC',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* --- TOP BRANDING & TOPIC BADGE --- */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 50,
          right: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 60,
          pointerEvents: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#38BDF8',
              boxShadow: '0 0 16px #38BDF8'
            }}
          />
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: '#F8FAFC',
              letterSpacing: '0.5px'
            }}
          >
            Lumina<span style={{ color: '#38BDF8' }}>Learn</span>
          </span>
        </div>

        <div
          style={{
            border: '1px solid rgba(56, 189, 248, 0.45)',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            borderRadius: 9999,
            padding: '8px 18px',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '1.2px',
            color: '#38BDF8',
            backdropFilter: 'blur(8px)'
          }}
        >
          VẬT LÝ QUANG HỌC
        </div>
      </div>

      {/* --- PROGRESS BAR AT TOP --- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          zIndex: 70
        }}
      >
        <div
          style={{
            width: `${progressRatio * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #38BDF8, #A855F7, #EF4444)'
          }}
        />
      </div>

      {/* ============================================================== */}
      {/* SCENE SEQUENCES (Continuous 60s narrative)                     */}
      {/* ============================================================== */}

      {/* --- SCENE 1: HOOK & RAINSTORM TRANSITION (0 - 240 frames, 8s) --- */}
      <Sequence from={0} durationInFrames={240}>
        <Scene1Hook frame={frame} width={width} height={height} />
      </Sequence>

      {/* --- SCENE 2: PRISM DISPERSION (240 - 540 frames, 10s) --- */}
      <Sequence from={240} durationInFrames={300}>
        <Scene2Prism frame={frame - 240} width={width} height={height} />
      </Sequence>

      {/* --- SCENE 3: RAINDROP ENTRY REFRACTION (540 - 900 frames, 12s) --- */}
      <Sequence from={540} durationInFrames={360}>
        <Scene3Refraction frame={frame - 540} width={width} height={height} />
      </Sequence>

      {/* --- SCENE 4: INTERNAL REFLECTION (900 - 1230 frames, 11s) --- */}
      <Sequence from={900} durationInFrames={330}>
        <Scene4Reflection frame={frame - 900} width={width} height={height} />
      </Sequence>

      {/* --- SCENE 5: DROPLET EXIT AT 40°-42° (1230 - 1560 frames, 11s) --- */}
      <Sequence from={1230} durationInFrames={330}>
        <Scene5Exit frame={frame - 1230} width={width} height={height} />
      </Sequence>

      {/* --- SCENE 6: FULL ATMOSPHERIC RAINBOW (1560 - 1800 frames, 8s) --- */}
      <Sequence from={1560} durationInFrames={240}>
        <Scene6Atmospheric frame={frame - 1560} width={width} height={height} />
      </Sequence>

      {/* ============================================================== */}
      {/* SYNCHRONIZED BURNED-IN SUBTITLE OVERLAY                        */}
      {/* ============================================================== */}
      {subtitlesEnabled && activeCue && (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
            left: 50,
            right: 50,
            zIndex: 80,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1.5px solid rgba(56, 189, 248, 0.45)',
              borderRadius: 18,
              padding: '16px 28px',
              maxWidth: '92%',
              textAlign: 'center',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)'
            }}
          >
            <span
              style={{
                fontSize: 27,
                lineHeight: 1.45,
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '0.2px',
                textShadow: '0 2px 6px rgba(0,0,0,0.9)'
              }}
            >
              {activeCue.text}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------
// Sub-scene Components
// ----------------------------------------------------------------------

const Scene1Hook: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const opacity = interpolate(frame, [0, 20, 210, 240], [0, 1, 1, 0]);
  const sunScale = interpolate(frame, [40, 180], [0.8, 1.15], {
    extrapolateRight: 'clamp'
  });
  const rainOffset = (frame * 18) % 120;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Animated Rain Falling Streaks */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {Array.from({ length: 30 }).map((_, i) => {
          const rx = (i * 37) % width;
          const ry = ((i * 73 + rainOffset * 6) % height);
          return (
            <line
              key={i}
              x1={rx}
              y1={ry}
              x2={rx - 15}
              y2={ry + 45}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Sun Breaking Through Clouds */}
      <div
        style={{
          transform: `scale(${sunScale})`,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FDE047 0%, #F59E0B 60%, rgba(245, 158, 11, 0) 100%)',
          boxShadow: '0 0 100px rgba(253, 224, 71, 0.65)',
          marginBottom: 40
        }}
      />

      {/* Large Hook Title Card */}
      <div
        style={{
          maxWidth: 920,
          textAlign: 'center',
          padding: '0 40px',
          zIndex: 10
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#38BDF8',
            letterSpacing: '2px',
            marginBottom: 16
          }}
        >
          CÂU HỎI KHOA HỌC
        </div>
        <h1
          style={{
            fontSize: 52,
            fontWeight: 900,
            lineHeight: 1.25,
            margin: '0 0 24px 0',
            color: '#F8FAFC',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)'
          }}
        >
          Vì sao sau cơn mưa lại xuất hiện{' '}
          <span
            style={{
              background: 'linear-gradient(90deg, #EF4444, #F59E0B, #10B981, #06B6D4, #8B5CF6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Cầu Vồng?
          </span>
        </h1>
        <p
          style={{
            fontSize: 24,
            color: '#94A3B8',
            lineHeight: 1.5,
            margin: 0
          }}
        >
          Bí mật đằng sau sự kết hợp kỳ diệu giữa những giọt nước mưa và ánh nắng Mặt Trời.
        </p>
      </div>
    </div>
  );
};

const Scene2Prism: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const progress = Math.min(1, Math.max(0, frame / 260));
  return (
    <PhysicsCameraTransitions
      currentScale={interpolate(frame, [0, 260], [0.95, 1.02])}
      currentPanY={interpolate(frame, [0, 260], [20, -10])}
    >
      <PrismDispersion
        frame={frame}
        progress={progress}
        width={width}
        height={height}
      />
    </PhysicsCameraTransitions>
  );
};

const Scene3Refraction: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const progress = Math.min(1, Math.max(0, frame / 320));
  return (
    <PhysicsCameraTransitions
      currentScale={interpolate(frame, [0, 320], [0.96, 1.05])}
      currentPanX={interpolate(frame, [0, 320], [15, -15])}
    >
      <RaindropRefraction
        frame={frame}
        progress={progress}
        width={width}
        height={height}
      />
    </PhysicsCameraTransitions>
  );
};

const Scene4Reflection: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const progress = Math.min(1, Math.max(0, frame / 290));
  return (
    <PhysicsCameraTransitions
      currentScale={interpolate(frame, [0, 290], [1.02, 1.08])}
      currentPanX={interpolate(frame, [0, 290], [-10, 10])}
    >
      <InternalReflection
        frame={frame}
        progress={progress}
        width={width}
        height={height}
      />
    </PhysicsCameraTransitions>
  );
};

const Scene5Exit: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const progress = Math.min(1, Math.max(0, frame / 300));
  return (
    <PhysicsCameraTransitions
      currentScale={interpolate(frame, [0, 300], [1.06, 0.98])}
    >
      <RainbowFormation
        frame={frame}
        progress={progress}
        width={width}
        height={height}
        viewMode="exit_droplet"
      />
    </PhysicsCameraTransitions>
  );
};

const Scene6Atmospheric: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height
}) => {
  const progress = Math.min(1, Math.max(0, frame / 220));
  return (
    <PhysicsCameraTransitions
      currentScale={interpolate(frame, [0, 220], [0.92, 1.0])}
      currentPanY={interpolate(frame, [0, 220], [30, 0])}
    >
      <RainbowFormation
        frame={frame}
        progress={progress}
        width={width}
        height={height}
        viewMode="atmospheric_arc"
      />
    </PhysicsCameraTransitions>
  );
};

