import React from 'react';
import { MASCOT_ROBOT_IMAGE } from './MascotRobotImage';

export interface MascotRobotProps {
  size?: number;
  glow?: boolean;
  style?: React.CSSProperties;
}

export const MascotRobot: React.FC<MascotRobotProps> = ({
  size = 260,
  glow = true,
  style,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={MASCOT_ROBOT_IMAGE}
        alt="LuminaLearn Mascot Robot"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: glow
            ? 'drop-shadow(0 18px 30px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 25px rgba(56, 189, 248, 0.4))'
            : 'drop-shadow(0 12px 20px rgba(0, 0, 0, 0.45))',
        }}
      />
    </div>
  );
};
