import React from 'react';
import { Composition } from 'remotion';
import { HybridVideoManifestSchema, simpsonFixture, LessonStoryboardSchema } from '@luminalearn/scene-schema';
import { z } from 'zod';
import { LuminaVideo, type LuminaVideoProps } from './compositions/LuminaVideo';
import { LuminaMathHybrid, type LuminaMathHybridProps } from './compositions/LuminaMathHybrid';
import { hybridDefaultManifest } from './fixtures/hybrid-default';

const LuminaVideoSchema = z.object({
  storyboard: LessonStoryboardSchema
});

const LuminaMathHybridSchema = z.object({ manifest: HybridVideoManifestSchema });

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
    </>
  );
};
