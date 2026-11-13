import React from 'react';
import { Composition } from 'remotion';
import {
  HybridVideoManifestSchema,
  simpsonFixture,
  LessonStoryboardSchema,
  RenderManifestV2Schema,
  EducationalStoryboardV3Schema,
  EducationalSceneV3Schema,
  VisualSceneDefinitionV3Schema,
  VerifiedFormulaStepsDataV1Schema
} from '@luminalearn/scene-schema';
import { AnimatedVisualDslSceneV3, FormulaSequenceSceneV3, RainbowFullScene, ExactRainbowIdenticalScene, ExactPhoneCallIdenticalScene, ExactCondensationIdenticalScene, ExactProjectileIdenticalScene, ExactEarthSeasonsIdenticalScene, ExactCloudIdenticalScene, UniversalPhysicsExplainerScene } from '@luminalearn/animation';
import { z } from 'zod';
import { LuminaVideo, type LuminaVideoProps } from './compositions/LuminaVideo';
import { LuminaMathHybrid, type LuminaMathHybridProps } from './compositions/LuminaMathHybrid';
import { LuminaDynamicV2, type LuminaDynamicV2Props } from './compositions/LuminaDynamicV2';
import { LuminaSceneV3, type LuminaSceneV3Props } from './compositions/LuminaSceneV3';
import { LuminaScenePreviewV3, type LuminaScenePreviewV3Props } from './compositions/LuminaScenePreviewV3';
import { hybridDefaultManifest } from './fixtures/hybrid-default';
import { dynamicV2DefaultManifest } from './fixtures/dynamic-v2-default';
import { perceptronStoryboardV3 } from './fixtures/v3/perceptron-v3';
import { gradientDescentStoryboardV3 } from './fixtures/v3/gradient-descent-v3';
import { attentionStoryboardV3 } from './fixtures/v3/attention-v3';
import { visualDslFixtureV3 } from './fixtures/v3/visual-dsl-v3';
import { mathTypographySceneV3 } from './fixtures/v3/math-typography-v3';
import { sprintBFormulaFixtureV3 } from './fixtures/v3/sprint-b-formula-v3';
import { sprintBDerivativeGraphFixtureV3 } from './fixtures/v3/sprint-b-derivative-graph-v3';
import { devfestAlgebraStoryboardV3 } from './fixtures/v3/devfest-algebra-v3';
import { devfestDerivativeStoryboardV3 } from './fixtures/v3/devfest-derivative-v3';
import { devfestGradientDescentStoryboardV3 } from './fixtures/v3/devfest-gradient-descent-v3';
import { devfestAlgebraLongformStoryboardV3, devfestDerivativeLongformStoryboardV3, devfestGradientLongformStoryboardV3 } from './fixtures/v3/devfest-longform-v3';
import { phoneProcessSceneV3, condensationParticleSceneV3, soundWaveSceneV3, projectileSceneV3, pendulumSceneV3, energySceneV3 } from './fixtures/v3/physics-format-v3';
import { rainbowPhysicsStoryboardV3 } from './fixtures/v3/rainbow-physics-v3';

const LuminaVideoSchema = z.object({
  storyboard: LessonStoryboardSchema
});

const LuminaMathHybridSchema = z.object({ manifest: HybridVideoManifestSchema });
const LuminaDynamicV2Schema = z.object({ manifest: RenderManifestV2Schema });
const LuminaSceneV3Schema = z.object({
  storyboard: EducationalStoryboardV3Schema,
  subtitlesEnabled: z.boolean().default(true),
  trustedProofContext: z.object({
    artifactIntegrityVerified: z.literal(true),
    approvedDraftVersion: z.number().int().positive(),
    verifiedBindingFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/))
  }).strict().optional(),
  subtitleCues: z.array(z.object({
    cueId: z.string().optional(),
    sceneId: z.string(),
    text: z.string(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative()
  })).optional()
});
const LuminaScenePreviewV3Schema = z.object({
  scene: EducationalSceneV3Schema,
  subtitlesEnabled: z.boolean().default(true),
  trustedProofContext: z.object({
    artifactIntegrityVerified: z.literal(true),
    approvedDraftVersion: z.number().int().positive(),
    verifiedBindingFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/))
  }).strict().optional()
});
const VisualDslCompositionV3Schema = z.object({ definition: VisualSceneDefinitionV3Schema });
const FormulaSequenceCompositionV3Schema = z.object({ data: VerifiedFormulaStepsDataV1Schema, subtitleText: z.string().optional() });

export const Root: React.FC = () => {
  return (
    <>
      <Composition<typeof LuminaVideoSchema, LuminaVideoProps>
        id="LuminaSimpson"
        component={LuminaVideo}
        durationInFrames={simpsonFixture.video.durationFrames}
        fps={simpsonFixture.video.fps}
        width={simpsonFixture.video.width}
        height={simpsonFixture.video.height}
        schema={LuminaVideoSchema}
        defaultProps={{
          storyboard: simpsonFixture
        }}
      />
      <Composition<typeof LuminaMathHybridSchema, LuminaMathHybridProps>
        id="LuminaMathHybrid"
        component={LuminaMathHybrid}
        durationInFrames={960}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaMathHybridSchema}
        defaultProps={{ manifest: hybridDefaultManifest }}
      />
      <Composition<typeof LuminaDynamicV2Schema, LuminaDynamicV2Props>
        id="LuminaDynamicV2"
        component={LuminaDynamicV2}
        durationInFrames={dynamicV2DefaultManifest.totalFrames}
        fps={dynamicV2DefaultManifest.fps}
        width={dynamicV2DefaultManifest.dimensions.width}
        height={dynamicV2DefaultManifest.dimensions.height}
        schema={LuminaDynamicV2Schema}
        defaultProps={{ manifest: dynamicV2DefaultManifest }}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="LuminaSceneV3"
        component={LuminaSceneV3}
        durationInFrames={Math.round(perceptronStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: perceptronStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24))
        })}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="LuminaScenePreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={Math.round(perceptronStoryboardV3.scenes[0].durationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: perceptronStoryboardV3.scenes[0], subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.scene.durationSeconds * 24)) })}
      />
      <Composition
        id="SprintBFormulaEngineV3"
        component={FormulaSequenceSceneV3}
        durationInFrames={240}
        fps={24}
        width={720}
        height={1280}
        schema={FormulaSequenceCompositionV3Schema}
        defaultProps={{ data: sprintBFormulaFixtureV3, subtitleText: 'Từng bước biến đổi giữ nguyên mệnh đề đại số đã được kiểm tra.' }}
      />
      <Composition
        id="SprintBDerivativeGraphV3"
        component={AnimatedVisualDslSceneV3}
        durationInFrames={240}
        fps={24}
        width={720}
        height={1280}
        schema={VisualDslCompositionV3Schema}
        defaultProps={{ definition: sprintBDerivativeGraphFixtureV3 }}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="LuminaSceneV3Perceptron"
        component={LuminaSceneV3}
        durationInFrames={Math.round(perceptronStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: perceptronStoryboardV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="LuminaSceneV3GradientDescent"
        component={LuminaSceneV3}
        durationInFrames={Math.round(gradientDescentStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: gradientDescentStoryboardV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="LuminaSceneV3Attention"
        component={LuminaSceneV3}
        durationInFrames={Math.round(attentionStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: attentionStoryboardV3, subtitlesEnabled: true }}
      />
      <Composition
        id="VisualDslSceneV3"
        component={AnimatedVisualDslSceneV3}
        durationInFrames={visualDslFixtureV3.timeline?.durationFrames ?? 240}
        fps={24}
        width={720}
        height={1280}
        schema={VisualDslCompositionV3Schema}
        defaultProps={{ definition: visualDslFixtureV3 }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="MathTypographyQaV3"
        component={LuminaScenePreviewV3}
        durationInFrames={240}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: mathTypographySceneV3, subtitlesEnabled: true }}
      />
      {/* DevFest 2026 Release Candidate Compositions */}
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestAlgebraIdentityV3"
        component={LuminaSceneV3}
        durationInFrames={Math.round(devfestAlgebraStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestAlgebraStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24))
        })}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestDerivativeTangentV3"
        component={LuminaSceneV3}
        durationInFrames={Math.round(devfestDerivativeStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestDerivativeStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24))
        })}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestGradientDescentV3"
        component={LuminaSceneV3}
        durationInFrames={Math.round(devfestGradientDescentStoryboardV3.totalDurationSeconds * 24)}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestGradientDescentStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24))
        })}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestAlgebraLongformV3"
        component={LuminaSceneV3}
        durationInFrames={7200}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestAlgebraLongformStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24)) })}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestDerivativeLongformV3"
        component={LuminaSceneV3}
        durationInFrames={7200}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestDerivativeLongformStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24)) })}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="DevFestGradientLongformV3"
        component={LuminaSceneV3}
        durationInFrames={7200}
        fps={24}
        width={720}
        height={1280}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: devfestGradientLongformStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 24)) })}
      />
      {/* Physics Animation Engine: Rainbow Formation Demo (9:16, 1080x1920, 30 FPS, 60s) */}
      <Composition
        id="LuminaRainbowPhysicsV3"
        component={RainbowFullScene}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ subtitlesEnabled: true }}
      />
      {/* Universal Physics Explainer Engine (9:16 Vertical Micro-Learning, 1080x1920 @ 30 FPS) */}
      <Composition
        id="LuminaPhysicsExplainerV3"
        component={UniversalPhysicsExplainerScene}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          topic: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
          subtitlesEnabled: true
        }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsProcessFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: phoneProcessSceneV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsParticleFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: condensationParticleSceneV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsWaveFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: soundWaveSceneV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsProjectileFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: projectileSceneV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsPendulumFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: pendulumSceneV3, subtitlesEnabled: true }}
      />
      <Composition<typeof LuminaScenePreviewV3Schema, LuminaScenePreviewV3Props>
        id="PhysicsEnergyFamilyPreviewV3"
        component={LuminaScenePreviewV3}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaScenePreviewV3Schema}
        defaultProps={{ scene: energySceneV3, subtitlesEnabled: true }}
      />
      {/* Exact Clone of Reference Video (1766 frames, 30 FPS, 58.86s, 1080x1920) */}
      <Composition
        id="LuminaExactRainbowClone"
        component={ExactRainbowIdenticalScene}
        durationInFrames={1766}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Exact Clone of Video 2 (Phone Call Physics, 2580 frames, 30 FPS, 86.00s, 1080x1920) */}
      <Composition
        id="LuminaExactPhoneCallClone"
        component={ExactPhoneCallIdenticalScene}
        durationInFrames={2580}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Exact Clone of Video 3 (Condensation / Cold Can, 1920 frames, 30 FPS, 64.0s, 1080x1920) */}
      <Composition
        id="LuminaExactCondensationClone"
        component={ExactCondensationIdenticalScene}
        durationInFrames={1920}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Exact Clone of Video 4 (Projectile Motion / Parabola, 1800 frames, 30 FPS, 60.0s, 1080x1920) */}
      <Composition
        id="LuminaExactProjectileClone"
        component={ExactProjectileIdenticalScene}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Exact Clone of Video 4 (Earth Seasons / 23.5 Tilt, 1680 frames, 30 FPS, 56.0s, 1080x1920) */}
      <Composition
        id="LuminaExactEarthSeasonsClone"
        component={ExactEarthSeasonsIdenticalScene}
        durationInFrames={1680}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Streamlined Clone of Video 5 (Cloud Scattering / Storm Cloud, 1380 frames, 30 FPS, 46.0s, 1080x1920) */}
      <Composition
        id="LuminaExactCloudClone"
        component={ExactCloudIdenticalScene}
        durationInFrames={1380}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition<typeof LuminaSceneV3Schema, LuminaSceneV3Props>
        id="LuminaPhysicsSceneV3"
        component={LuminaSceneV3}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        schema={LuminaSceneV3Schema}
        defaultProps={{ storyboard: rainbowPhysicsStoryboardV3, subtitlesEnabled: true }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.storyboard.totalDurationSeconds * 30))
        })}
      />
    </>
  );
};
