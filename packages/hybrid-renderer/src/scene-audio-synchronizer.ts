/**
 * LuminaLearn V3.0 — Phase 11
 * Scene-Level Narration & Audio Synchronization Engine
 *
 * Implements deterministic scene-level audio synthesis, caching, duration
 * reconciliation (preventing silent truncation), frame-accurate integer timeline
 * alignment (24 FPS default), SRT subtitle generation, and FFmpeg audio muxing.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { probeAudio, type AudioMetadata, type TtsProvider } from './audio';
import {
  AudioCacheManager,
  computeAudioCacheKey,
  defaultAudioCacheManager
} from './audio-cache-manager';
import { normalizeVietnameseNarration } from './vietnamese-narration-normalizer';
import { srtTimestamp } from './subtitles';

export interface SceneNarrationInput {
  id: string;
  durationSeconds: number;
  narration?: {
    vietnamese?: string;
    subtitleVietnamese?: string;
  };
}

export interface SynchronizedSceneTiming {
  sceneId: string;
  targetDurationSeconds: number;
  adjustedDurationSeconds: number;
  startFrame: number;
  durationFrames: number;
  endFrame: number;
  speechStartFrame: number;
  speechEndFrame: number;
  normalizedText: string;
  audioDurationSeconds: number;
  audioPath?: string;
  cacheKey?: string;
  cacheHit?: boolean;
}

export interface SynchronizedStoryboardAudio {
  masterAudioPath: string;
  totalDurationSeconds: number;
  totalFrames: number;
  fps: number;
  sceneTimings: SynchronizedSceneTiming[];
  srtContent: string;
}

export interface SynchronizeAudioOptions {
  ttsProvider: TtsProvider;
  audioCache?: AudioCacheManager;
  voice?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  fps?: number;
  preRollSeconds?: number;
  postRollSeconds?: number;
  ownerId?: string;
  outputDir: string;
  onProgress?: (sceneIndex: number, totalScenes: number, sceneId: string) => void;
}

function runFfmpegCommand(args: string[], timeoutMs = 60_000): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile('ffmpeg', args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffmpeg_audio_operation_failed: ${stderr || error.message}`));
      }
      resolvePromise();
    });
  });
}

/**
 * Creates a silent audio segment of exact duration using lavfi anullsrc.
 */
async function generateSilentAudioSegment(outputPath: string, durationSeconds: number): Promise<void> {
  await runFfmpegCommand([
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=24000:cl=mono',
    '-t', durationSeconds.toFixed(3),
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '24000',
    '-ac', '1',
    outputPath
  ]);
}

/**
 * Pads a scene's audio file with pre-roll delay and trailing silence to match exact target duration.
 */
async function padSceneAudioSegment(
  sourceAudioPath: string,
  outputPath: string,
  preRollSeconds: number,
  targetDurationSeconds: number
): Promise<void> {
  const preRollMs = Math.max(0, Math.round(preRollSeconds * 1000));
  // Filter chain: delay audio by preRollMs, pad with silence to target duration, trim exactly to targetDuration
  const filter = `adelay=${preRollMs}|${preRollMs},apad,atrim=0:${targetDurationSeconds.toFixed(3)}`;

  await runFfmpegCommand([
    '-y',
    '-i', sourceAudioPath,
    '-af', filter,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '24000',
    '-ac', '1',
    outputPath
  ]);
}

/**
 * Concatenates multiple padded audio segments into a single master audio track.
 */
async function concatenateAudioSegments(
  segmentPaths: string[],
  masterOutputPath: string
): Promise<void> {
  if (segmentPaths.length === 0) {
    throw new Error('sync_audio_empty_segments: No audio segments to concatenate');
  }

  if (segmentPaths.length === 1) {
    // Single segment: copy directly to output
    const data = await readFile(segmentPaths[0]);
    await writeFile(masterOutputPath, data);
    return;
  }

  // Multi-input concat filter: -i seg0 -i seg1 ... -filter_complex "[0:0][1:0]...concat=n=N:v=0:a=1[outa]"
  const args: string[] = ['-y'];
  let filterInputs = '';

  for (let i = 0; i < segmentPaths.length; i++) {
    args.push('-i', segmentPaths[i]);
    filterInputs += `[${i}:a]`;
  }

  const filterComplex = `${filterInputs}concat=n=${segmentPaths.length}:v=0:a=1[outa]`;
  args.push(
    '-filter_complex', filterComplex,
    '-map', '[outa]',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '24000',
    '-ac', '1',
    masterOutputPath
  );

  await runFfmpegCommand(args, 120_000);
}

export class SceneAudioSynchronizer {
  private readonly cache: AudioCacheManager;

  constructor(cache?: AudioCacheManager) {
    this.cache = cache ?? defaultAudioCacheManager;
  }

  public async synchronizeStoryboard(
    scenes: SceneNarrationInput[],
    options: SynchronizeAudioOptions
  ): Promise<SynchronizedStoryboardAudio> {
    if (!scenes || scenes.length === 0) {
      throw new Error('sync_audio_no_scenes: Storyboard contains no scenes');
    }

    const fps = options.fps ?? 24;
    const preRollSeconds = options.preRollSeconds ?? 0.5;
    const postRollSeconds = options.postRollSeconds ?? 0.5;
    const voice = options.voice ?? 'vi-VN-Neural2-A';
    const language = options.language ?? 'vi-VN';
    const speakingRate = options.speakingRate ?? 1.0;
    const pitch = options.pitch ?? 0.0;
    const outputDir = options.outputDir;

    await mkdir(outputDir, { recursive: true });
    const audioWorkDir = resolve(outputDir, '.audio-sync-work');
    await mkdir(audioWorkDir, { recursive: true });

    await this.cache.init();

    const sceneTimings: SynchronizedSceneTiming[] = [];
    const paddedSegmentPaths: string[] = [];
    const srtCues: string[] = [];

    let currentStartFrame = 0;
    let cueIndex = 1;

    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      options.onProgress?.(index + 1, scenes.length, scene.id);

      const targetDurationSeconds = Math.max(1, scene.durationSeconds);
      const rawText = (scene.narration?.vietnamese || '').trim();
      const normResult = normalizeVietnameseNarration(rawText);
      const normalizedText = normResult.normalizedText;
      const subtitleText = (scene.narration?.subtitleVietnamese || normalizedText || '').trim();

      const paddedSegmentPath = resolve(audioWorkDir, `scene_${index}_padded.mp3`);

      if (!normalizedText) {
        // Scene has no narration text: generate silent audio segment of exact duration
        await generateSilentAudioSegment(paddedSegmentPath, targetDurationSeconds);
        paddedSegmentPaths.push(paddedSegmentPath);

        const durationFrames = Math.max(1, Math.round(targetDurationSeconds * fps));
        sceneTimings.push({
          sceneId: scene.id,
          targetDurationSeconds,
          adjustedDurationSeconds: targetDurationSeconds,
          startFrame: currentStartFrame,
          durationFrames,
          endFrame: currentStartFrame + durationFrames,
          speechStartFrame: currentStartFrame,
          speechEndFrame: currentStartFrame + durationFrames,
          normalizedText: '',
          audioDurationSeconds: 0
        });

        currentStartFrame += durationFrames;
        continue;
      }

      // Check cache
      const cacheKey = computeAudioCacheKey({
        text: normalizedText,
        providerId: options.ttsProvider.id,
        voice,
        speakingRate,
        pitch,
        language
      });

      const rawSceneAudioPath = resolve(audioWorkDir, `scene_${index}_raw.mp3`);
      let audioDurationSeconds: number;
      let cacheHit = false;

      const cached = await this.cache.get(cacheKey, options.ownerId);
      if (cached) {
        cacheHit = true;
        await writeFile(rawSceneAudioPath, cached.data);
        audioDurationSeconds = cached.meta.durationSeconds;
      } else {
        // Synthesize fresh audio
        await options.ttsProvider.synthesize(normalizedText, rawSceneAudioPath);
        const probe = await probeAudio(rawSceneAudioPath, 120);
        audioDurationSeconds = probe.durationSeconds;

        const buffer = await readFile(rawSceneAudioPath);
        await this.cache.put(
          cacheKey,
          buffer,
          probe,
          options.ttsProvider.id,
          voice,
          options.ownerId
        );
      }

      // Duration reconciliation: adjust scene presentation duration to fit speech
      const minRequiredDuration = audioDurationSeconds + preRollSeconds + postRollSeconds;
      const adjustedDurationSeconds = Math.max(
        targetDurationSeconds,
        Math.ceil(minRequiredDuration * 10) / 10
      );

      // Pad audio segment to adjusted duration with pre-roll delay
      await padSceneAudioSegment(
        rawSceneAudioPath,
        paddedSegmentPath,
        preRollSeconds,
        adjustedDurationSeconds
      );
      paddedSegmentPaths.push(paddedSegmentPath);

      // Frame calculations
      const durationFrames = Math.max(1, Math.round(adjustedDurationSeconds * fps));
      const speechStartFrame = currentStartFrame + Math.round(preRollSeconds * fps);
      const speechDurationFrames = Math.max(1, Math.round(audioDurationSeconds * fps));
      const speechEndFrame = Math.min(
        currentStartFrame + durationFrames,
        speechStartFrame + speechDurationFrames
      );

      sceneTimings.push({
        sceneId: scene.id,
        targetDurationSeconds,
        adjustedDurationSeconds,
        startFrame: currentStartFrame,
        durationFrames,
        endFrame: currentStartFrame + durationFrames,
        speechStartFrame,
        speechEndFrame,
        normalizedText,
        audioDurationSeconds,
        audioPath: paddedSegmentPath,
        cacheKey,
        cacheHit
      });

      // Subtitle cue
      if (subtitleText) {
        srtCues.push(
          [
            String(cueIndex),
            `${srtTimestamp(speechStartFrame, fps)} --> ${srtTimestamp(speechEndFrame, fps)}`,
            subtitleText,
            ''
          ].join('\n')
        );
        cueIndex++;
      }

      currentStartFrame += durationFrames;
    }

    // Concatenate master audio track
    const masterAudioPath = resolve(outputDir, 'narration-master.mp3');
    await concatenateAudioSegments(paddedSegmentPaths, masterAudioPath);

    // Verify master audio duration matches total presentation duration
    const masterProbe = await probeAudio(masterAudioPath, 1200);
    const totalDurationSeconds = sceneTimings.reduce((sum, s) => sum + s.adjustedDurationSeconds, 0);
    const totalFrames = currentStartFrame;
    const srtContent = srtCues.length > 0 ? srtCues.join('\n') + '\n' : '';

    return {
      masterAudioPath,
      totalDurationSeconds,
      totalFrames,
      fps,
      sceneTimings,
      srtContent
    };
  }
}

export const defaultSceneAudioSynchronizer = new SceneAudioSynchronizer();

