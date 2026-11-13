import React from 'react';
import { useVideoConfig } from 'remotion';
import { ExactRainbowIdenticalScene } from './ExactRainbowIdenticalScene';
import { ExactPhoneCallIdenticalScene } from './ExactPhoneCallIdenticalScene';
import { ExactCondensationIdenticalScene } from './ExactCondensationIdenticalScene';

export interface UniversalPhysicsExplainerProps {
  topic?: string;
  domain?: string;
  subtitlesEnabled?: boolean;
}

/**
 * UniversalPhysicsExplainerScene
 * Unified 9:16 vertical generative component for physics phenomena in LuminaLearn.
 * Dynamically selects and coordinates the pedagogical simulation canvas based on topic semantics:
 * - Optics: 2D raindrop refraction, internal reflection, and Snell dispersion
 * - Telecom: 6-stage telecommunication chain (Micro -> ADC -> EM Wave -> BTS -> Lorentz speaker)
 * - Thermodynamics: Water vapor condensation and dew point mechanics
 */
export const UniversalPhysicsExplainerScene: React.FC<UniversalPhysicsExplainerProps> = ({
  topic = 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
  subtitlesEnabled = true
}) => {
  const isTelecom = /điện thoại|phone|nghe gọi|viễn thông|bts|faraday|sóng/i.test(topic);
  const isCondensation = /ngưng tụ|sương|lon nước|lạnh|hơi nước|dew point/i.test(topic);

  if (isTelecom) {
    return <ExactPhoneCallIdenticalScene />;
  }

  if (isCondensation) {
    return <ExactCondensationIdenticalScene />;
  }

  // Default to Optics Rainbow phenomenon
  return <ExactRainbowIdenticalScene />;
};
