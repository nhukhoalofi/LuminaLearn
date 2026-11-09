import React from 'react';
import { Composition } from 'remotion';
import {
  HybridVideoManifestSchema,
  simpsonFixture,
  LessonStoryboardSchema,
  RenderManifestV2Schema,
  EducationalStoryboardV3Schema,
  EducationalSceneV3Schema,
  VisualSceneDefinitionV3Schema
} from '@luminalearn/scene-schema';
import { VisualDslSceneV3 } from '@luminalearn/animation';
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

const LuminaVideoSchema = z.object({
  storyboard: LessonStoryboardSchema
});

const LuminaMathHybridSchema = z.object({ manifest: HybridVideoManifestSchema });
const LuminaDynamicV2Schema = z.object({ manifest: RenderManifestV2Schema });
const LuminaSceneV3Schema = z.object({ storyboard: EducationalStoryboardV3Schema, subtitlesEnabled: z.boolean().default(true) });
const LuminaScenePreviewV3Schema = z.object({ scene: EducationalSceneV3Schema, subtitlesEnabled: z.boolean().default(true) });
const VisualDslCompositionV3Schema = z.object({ definition: VisualSceneDefinitionV3Schema });

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
        component={VisualDslSceneV3}
        durationInFrames={visualDslFixtureV3.timeline?.durationFrames ?? 240}
        fps={24}
        width={720}
        height={1280}
        schema={VisualDslCompositionV3Schema}
        defaultProps={{ definition: visualDslFixtureV3 }}
      />
    </>
  );
};
