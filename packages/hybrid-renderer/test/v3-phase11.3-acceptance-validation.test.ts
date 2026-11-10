/**
 * LuminaLearn V3.0 — Phase 11.3
 * Test Suite: Acceptance Artifacts Validation & Fail-Closed Assertions
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateAcceptanceArtifactsV3,
  type ValidateAcceptanceInput
} from '../src/render-v3-phase11-acceptance';

function createBaseValidInput(mode: 'offline' | 'real-tts' = 'offline'): ValidateAcceptanceInput {
  return {
    outputPath: '/test/output/final.mp4',
    srtPath: '/test/output/subtitles.srt',
    resolvedTimelinePath: '/test/output/resolved-presentation-timeline.json',
    targetDurationSeconds: 60,
    expectedFps: 24,
    expectedResolution: '720x1280',
    expectedMode: mode,
    sourceArtifact: {
      artifactId: 'art_valid_123',
      contentHash: 'hash_abc_456'
    },
    probeData: {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 720,
          height: 1280,
          r_frame_rate: '24/1',
          avg_frame_rate: '24/1',
          duration: '60.000000'
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
          sample_rate: '48000',
          channels: 1,
          duration: '60.000000'
        }
      ],
      format: {
        duration: '60.000000'
      }
    },
    audioSignal: {
      meanVolumeDb: mode === 'offline' ? -91.0 : -22.5,
      maxVolumeDb: mode === 'offline' ? -91.0 : -3.2,
      isSilent: mode === 'offline',
      audioClassification: mode === 'offline' ? 'silent_fixture' : 'audible_voice'
    },
    srtContent: `1\n00:00:01,000 --> 00:00:05,000\nChào mừng các bạn đến với bài học.\n\n2\n00:00:06,000 --> 00:00:10,000\nNội dung tiếp theo.\n`,
    burnedSubtitleCues: [
      { sceneId: 'scene_1', text: 'Chào mừng các bạn đến với bài học.', startFrame: 24, endFrame: 120 },
      { sceneId: 'scene_1', text: 'Nội dung tiếp theo.', startFrame: 144, endFrame: 240 }
    ],
    resolvedTimelineContent: JSON.stringify({
      schemaVersion: 'resolved-presentation-timeline-v1',
      sourceArtifactId: 'art_valid_123',
      sourceContentHash: 'hash_abc_456',
      approvedDraftVersion: 1,
      fps: 24,
      totalFrames: 1440,
      audioProvenance: {
        audioClassification: mode === 'offline' ? 'silent_fixture' : 'audible_non_silent'
      },
      scenes: [{
        sceneId: 'scene_1',
        startFrame: 0,
        durationFrames: 1440,
        endFrame: 1440,
        speechStartFrame: 24,
        speechEndFrame: 240
      }]
    })
  };
}

describe('Phase 11.3 — Acceptance Artifacts Validation & Fail-Closed Checks', () => {
  it('1. Accepts a fully compliant offline mock acceptance fixture', () => {
    const input = createBaseValidInput('offline');
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.errors.length, 0);
    assert.equal(result.metrics.videoCodec, 'h264');
    assert.equal(result.metrics.audioCodec, 'aac');
    assert.equal(result.metrics.resolution, '720x1280');
    assert.equal(result.metrics.fps, 24);
    assert.equal(result.metrics.totalFrames, 1440);
  });

  it('2. Accepts a fully compliant real TTS acceptance fixture', () => {
    const input = createBaseValidInput('real-tts');
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.errors.length, 0);
    assert.equal(result.metrics.audioClassification, 'audible_voice');
  });

  it('3. Rejects missing video stream', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams = input.probeData.streams.filter((s: any) => s.codec_type !== 'video');
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('missing_video_stream')));
  });

  it('4. Rejects invalid video codec (e.g. hevc / vp9 instead of h264)', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[0].codec_name = 'hevc';
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('invalid_video_codec')));
  });

  it('5. Rejects invalid resolution (e.g. horizontal 1280x720 instead of vertical 720x1280)', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[0].width = 1280;
    input.probeData.streams[0].height = 720;
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('invalid_resolution')));
  });

  it('6. Rejects invalid framerate (e.g. 30 fps instead of 24)', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[0].r_frame_rate = '30/1';
    input.probeData.streams[0].avg_frame_rate = '30/1';
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('invalid_fps')));
  });

  it('7. Rejects missing audio stream', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams = input.probeData.streams.filter((s: any) => s.codec_type !== 'audio');
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('missing_audio_stream')));
  });

  it('8. Rejects invalid audio codec (e.g. mp3 instead of aac)', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[1].codec_name = 'mp3';
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('invalid_audio_codec')));
  });

  it('9. Rejects duration delta exceeding tolerance (e.g. 55s for 60s target)', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[0].duration = '55.000000';
    input.probeData.format.duration = '55.000000';
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('duration_mismatch')));
  });

  it('10. Rejects audio and video duration drift exceeding tolerance', () => {
    const input = createBaseValidInput('offline');
    input.probeData.streams[1].duration = '58.000000'; // 2s shorter than video
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('av_sync_drift')));
  });

  it('11. Rejects missing or empty subtitles.srt', () => {
    const input = createBaseValidInput('offline');
    input.srtContent = '';
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('empty_subtitles_srt')));
  });

  it('12. Rejects inverted subtitle cue timestamps (start >= end)', () => {
    const input = createBaseValidInput('offline');
    input.srtContent = `1\n00:00:10,000 --> 00:00:05,000\nInverted cue.\n`;
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('invalid_subtitle_cue_timestamp')));
  });

  it('13. Rejects tampered resolved timeline metadata', () => {
    const input = createBaseValidInput('offline');
    input.resolvedTimelineContent = JSON.stringify({
      schemaVersion: 'resolved-presentation-timeline-v1',
      sourceArtifactId: 'forged_artifact_id',
      sourceContentHash: 'forged_hash',
      fps: 24,
      totalFrames: 1440
    });
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('timeline_artifact_id_mismatch')));
    assert.ok(result.errors.some((e) => e.includes('timeline_content_hash_mismatch')));
  });

  it('14. Rejects unexpected silence in real TTS mode', () => {
    const input = createBaseValidInput('real-tts');
    input.audioSignal = {
      meanVolumeDb: -91.0,
      maxVolumeDb: -91.0,
      isSilent: true,
      audioClassification: 'silent_fixture'
    };
    const result = validateAcceptanceArtifactsV3(input);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('unexpected_silent_signal_in_real_tts_mode')));
  });

  it('15. Rejects out-of-order and overlapping SRT cues', () => {
    const input = createBaseValidInput();
    input.srtContent = `1\n00:00:06,000 --> 00:00:10,000\nMột\n\n2\n00:00:04,000 --> 00:00:08,000\nHai\n`;
    input.burnedSubtitleCues = [
      { sceneId: 'scene_1', text: 'Một', startFrame: 144, endFrame: 240 },
      { sceneId: 'scene_1', text: 'Hai', startFrame: 96, endFrame: 192 }
    ];
    const result = validateAcceptanceArtifactsV3(input);
    assert.ok(result.errors.some((error) => error.includes('subtitle_cue_out_of_order')));
    assert.ok(result.errors.some((error) => error.includes('subtitle_cue_overlap')));
  });

  it('16. Rejects subtitle cues outside presentation and scene bounds', () => {
    const input = createBaseValidInput();
    input.srtContent = `1\n00:00:59,000 --> 00:01:01,000\nNgoài biên\n`;
    input.burnedSubtitleCues = [{ sceneId: 'scene_1', text: 'Ngoài biên', startFrame: 1416, endFrame: 1464 }];
    const result = validateAcceptanceArtifactsV3(input);
    assert.ok(result.errors.some((error) => error.includes('subtitle_cue_out_of_bounds')));
    assert.ok(result.errors.some((error) => error.includes('subtitle_scene_bounds_error')));
  });

  it('17. Rejects burned subtitle text/timing that differs from SRT', () => {
    const input = createBaseValidInput();
    input.burnedSubtitleCues[0].text = 'Nội dung đã bị đổi';
    const result = validateAcceptanceArtifactsV3(input);
    assert.ok(result.errors.some((error) => error.includes('subtitle_parity_mismatch')));
  });

  it('18. Rejects discontinuous resolved scene timing', () => {
    const input = createBaseValidInput();
    const timeline = JSON.parse(input.resolvedTimelineContent);
    timeline.scenes = [
      { sceneId: 'scene_1', startFrame: 0, durationFrames: 700, endFrame: 700, speechStartFrame: 24, speechEndFrame: 240 },
      { sceneId: 'scene_2', startFrame: 701, durationFrames: 739, endFrame: 1440, speechStartFrame: 701, speechEndFrame: 800 }
    ];
    input.resolvedTimelineContent = JSON.stringify(timeline);
    const result = validateAcceptanceArtifactsV3(input);
    assert.ok(result.errors.some((error) => error.includes('timeline_scene_continuity_error')));
  });

  it('19. Rejects contradictory audio classification metadata', () => {
    const input = createBaseValidInput('offline');
    input.audioSignal = { meanVolumeDb: -20, maxVolumeDb: -2, isSilent: false, audioClassification: 'audible_voice' };
    const result = validateAcceptanceArtifactsV3(input);
    assert.ok(result.errors.some((error) => error.includes('unexpected_audible_signal_in_offline_mock')));
  });
});
