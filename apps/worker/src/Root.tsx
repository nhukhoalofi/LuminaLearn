import React from 'react';
import { Composition } from 'remotion';
import {
  HybridVideoManifestSchema,
  simpsonFixture,
  LessonStoryboardSchema,
  RenderManifestV2Schema
} from '@luminalearn/scene-schema';
import { z } from 'zod';
import { LuminaVideo, type LuminaVideoProps } from './compositions/LuminaVideo';
import { LuminaMathHybrid, type LuminaMathHybridProps } from './compositions/LuminaMathHybrid';
import { LuminaDynamicV2, type LuminaDynamicV2Props } from './compositions/LuminaDynamicV2';
import { hybridDefaultManifest } from './fixtures/hybrid-default';
import { dynamicV2DefaultManifest } from './fixtures/dynamic-v2-default';

const LuminaVideoSchema = z.object({
  storyboard: LessonStoryboardSchema
});

const LuminaMathHybridSchema = z.object({ manifest: HybridVideoManifestSchema });
const LuminaDynamicV2Schema = z.object({ manifest: RenderManifestV2Schema });

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
    </>
  );
};
