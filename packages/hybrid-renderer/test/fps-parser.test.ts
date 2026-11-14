import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRationalFps } from '../src/fps-parser.js';

describe('Safe Rational FPS Parser', () => {
  it('parses standard integer ratios like 24/1 and 30/1', () => {
    assert.equal(parseRationalFps('24/1'), 24);
    assert.equal(parseRationalFps('30/1'), 30);
    assert.equal(parseRationalFps('60/1'), 60);
  });

  it('parses NTSC fractional ratios like 30000/1001 and 24000/1001', () => {
    const fps2997 = parseRationalFps('30000/1001');
    assert.ok(Math.abs(fps2997 - 29.97002997) < 0.001);
    const fps23976 = parseRationalFps('24000/1001');
    assert.ok(Math.abs(fps23976 - 23.97602397) < 0.001);
  });

  it('parses raw integers and trims whitespace', () => {
    assert.equal(parseRationalFps(' 24 '), 24);
    assert.equal(parseRationalFps('25'), 25);
  });

  it('returns fallback for empty, null, or undefined input', () => {
    assert.equal(parseRationalFps(undefined), 24);
    assert.equal(parseRationalFps(null), 24);
    assert.equal(parseRationalFps(''), 24);
    assert.equal(parseRationalFps('  ', 30), 30);
  });

  it('rejects division by zero', () => {
    assert.throws(() => parseRationalFps('24/0'), /invalid_fps_division/);
  });

  it('rejects non-numeric characters, operators, and code injection attempts', () => {
    assert.throws(() => parseRationalFps('console.log(1)'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('24; process.exit(1)'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('24+1'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('24*1'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('24/1/1'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('-24/1'), /invalid_fps_format/);
    assert.throws(() => parseRationalFps('NaN'), /invalid_fps_format/);
  });
});

