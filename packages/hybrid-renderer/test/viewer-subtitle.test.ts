import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViewerSubtitleTextV3 } from '../src/pipeline-v3';

describe('viewer-facing derivative subtitles', () => {
  it('replaces the legacy raw limit syntax without changing ordinary subtitles', () => {
    assert.equal(
      normalizeViewerSubtitleTextV3("f'(x) = lim_{h⟶0} [(x+h)² - x²] / h = lim_{h⟶0} (2x + h) = 2x"),
      'Lấy giới hạn khi h tiến về 0, thương sai phân cho f phẩy của x bằng 2x.'
    );
    assert.equal(normalizeViewerSubtitleTextV3('  Phụ đề bình thường.  '), 'Phụ đề bình thường.');
  });
});
