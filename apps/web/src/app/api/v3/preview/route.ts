import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EducationalSceneV3Schema, EducationalStoryboardV3 } from '@luminalearn/scene-schema';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(process.cwd(), '../..');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sceneParse = EducationalSceneV3Schema.safeParse(body.scene);
    if (!sceneParse.success) {
      return NextResponse.json(
        {
          success: false,
          error: `invalid_scene_payload: ${sceneParse.error.errors.map((e) => `[${e.path.join('.')}] ${e.message}`).join(', ')}`
        },
        { status: 400 }
      );
    }

    const scene = sceneParse.data;
    const requestedFrame = typeof body.frame === 'number' && body.frame >= 0 ? Math.floor(body.frame) : 24;
    const subtitlesEnabled = body.subtitlesEnabled !== false;

    // Build a standalone 1-scene storyboard for Remotion composition
    const previewStoryboard: EducationalStoryboardV3 = {
      storyboardId: `sb_prev_${Date.now()}`,
      lessonId: `lesson_prev_${Date.now()}`,
      scenes: [scene],
      totalDurationSeconds: scene.durationSeconds
    };

    const previewHash = createHash('sha256')
      .update(JSON.stringify({ scene, frame: requestedFrame, subtitlesEnabled }))
      .digest('hex')
      .slice(0, 12);

    const previewDir = resolve(repositoryRoot, 'outputs', 'previews');
    await mkdir(previewDir, { recursive: true });

    const propsPath = resolve(previewDir, `props_${previewHash}.json`);
    const outputPath = resolve(previewDir, `preview_${previewHash}.png`);

    await writeFile(
      propsPath,
      JSON.stringify({ storyboard: previewStoryboard, subtitlesEnabled }),
      'utf8'
    );

    const workerDir = resolve(repositoryRoot, 'apps', 'worker');
    const remotionCli = resolve(workerDir, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

    // Render single frame using Remotion CLI still
    await execFileAsync(
      process.execPath,
      [
        remotionCli,
        'still',
        'src/index.ts',
        'LuminaSceneV3',
        outputPath,
        '--props',
        propsPath,
        '--frame',
        String(requestedFrame),
        '--image-format',
        'png'
      ],
      {
        cwd: workerDir,
        timeout: 45_000,
        windowsHide: true
      }
    );

    // Read the rendered PNG as base64 data URL
    const imageBuffer = await readFile(outputPath);
    const base64Data = imageBuffer.toString('base64');
    const previewDataUrl = `data:image/png;base64,${base64Data}`;

    // Clean up temporary props file
    await rm(propsPath, { force: true }).catch(() => {});

    return NextResponse.json({
      success: true,
      frame: requestedFrame,
      totalFrames: Math.round(scene.durationSeconds * 24),
      previewDataUrl,
      sceneId: scene.sceneId,
      sceneType: scene.sceneType
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `preview_render_failed: ${message}`
      },
      { status: 500 }
    );
  }
}

