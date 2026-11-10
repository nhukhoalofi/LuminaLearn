import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { EducationalSceneV3 } from '@luminalearn/scene-schema';
import type { TrustedProofContextV3 } from '@luminalearn/animation';
import { LuminaBrandOverlayV3, SceneDispatcherV3 } from './LuminaSceneV3';

export interface LuminaScenePreviewV3Props {
  scene: EducationalSceneV3;
  subtitlesEnabled?: boolean;
  trustedProofContext?: TrustedProofContextV3;
  [key: string]: unknown;
}

/** A single-scene composition; it deliberately does not pretend to be a storyboard. */
export const LuminaScenePreviewV3: React.FC<LuminaScenePreviewV3Props> = ({ scene, subtitlesEnabled = true, trustedProofContext }) => (
  <AbsoluteFill style={{ backgroundColor: '#070B14' }}>
    <SceneDispatcherV3 scene={scene} subtitlesEnabled={subtitlesEnabled} trustedProofContext={trustedProofContext} />
    <LuminaBrandOverlayV3 />
  </AbsoluteFill>
);

