import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

async function verifyCompletedDownloads(page: Page, request: APIRequestContext) {
  const job = page.getByTestId('v3-job');
  const videoLink = job.getByRole('link', { name: /MP4 V3/ });
  await expect(videoLink).toBeVisible({ timeout: 12 * 60_000 });
  const videoHref = await videoLink.getAttribute('href');
  expect(videoHref).toBeTruthy();
  const video = await request.get(videoHref!.replace('?download=1', ''), { headers: { Range: 'bytes=0-4095' } });
  expect(video.status()).toBe(206);
  expect(video.headers()['content-type']).toContain('video/mp4');
  expect((await video.body()).byteLength).toBeGreaterThan(100);

  const subtitleHref = await job.getByRole('link', { name: /phụ đề V3/ }).getAttribute('href');
  expect(subtitleHref).toBeTruthy();
  const subtitles = await request.get(subtitleHref!);
  expect(subtitles.status()).toBe(200);
  expect(subtitles.headers()['content-type']).toContain('application/x-subrip');
  const srt = await subtitles.text();
  expect(srt).toContain('-->');
  expect(srt).toMatch(/[À-ỹ]/);
  return videoHref!;
}

async function reviewApproveAndWait(page: Page, request: APIRequestContext) {
  const draft = page.getByTestId('v3-draft');
  await draft.getByRole('button', { name: /Xác nhận rà soát ngữ nghĩa/ }).click();
  await expect(draft).toContainText('ready_for_approval', { timeout: 120_000 });
  await draft.getByRole('button', { name: /Duyệt & render MP4/ }).click();
  return verifyCompletedDownloads(page, request);
}

test('Phase 8 D1 — browser Math 60s edit, preview, revalidate, approve, MP4 and SRT @real-render', async ({ page, request }) => {
  test.setTimeout(15 * 60_000);
  await page.goto('/');
  const studio = page.getByTestId('v3-teacher-studio');
  await studio.locator('select').nth(0).selectOption('mathematics');
  await studio.getByRole('button', { name: /7 hằng đẳng thức.*render-ready/ }).click();
  await studio.locator('select').nth(1).selectOption('60s');
  await studio.getByRole('button', { name: /Tạo bài học V3/ }).click();

  const draft = page.getByTestId('v3-draft');
  await expect(draft.getByTestId('v3-timeline-viewer')).toContainText('60s', { timeout: 120_000 });
  await expect(draft.getByTestId('v3-math-panel')).toContainText('formally_verified');
  const preview = draft.getByTestId('v3-preview-panel');
  await preview.getByRole('button', { name: /Render Preview Frame/ }).click();
  await expect(preview.locator('img')).toBeVisible({ timeout: 60_000 });

  const sceneTitle = draft.getByTestId('v3-scene-inspector').locator('input.form-input').first();
  await sceneTitle.fill(`${await sceneTitle.inputValue()} — giáo viên rà soát`);
  await expect(draft.getByRole('alert')).toContainText('Proof Invalidation Warning');
  await expect(preview.getByRole('button', { name: /Render Preview Frame/ })).toBeDisabled();
  await draft.getByRole('button', { name: /Lưu & tái kiểm định/ }).click();
  await expect(draft.getByRole('alert')).toHaveCount(0, { timeout: 120_000 });
  await expect(draft).toContainText('v2');
  await preview.getByRole('button', { name: /Render Preview Frame/ }).click();
  await expect(preview.locator('img')).toBeVisible({ timeout: 60_000 });

  await reviewApproveAndWait(page, request);
});

test('Phase 8 D2 — browser Gradient Descent 180s preview and real segmented render @real-render', async ({ page, request }) => {
  test.setTimeout(15 * 60_000);
  await page.goto('/');
  const studio = page.getByTestId('v3-teacher-studio');
  await studio.getByRole('button', { name: /Gradient Descent.*render-ready/ }).click();
  await studio.locator('select').nth(1).selectOption('180s');
  await studio.getByRole('button', { name: /Tạo bài học V3/ }).click();

  const draft = page.getByTestId('v3-draft');
  await expect(draft.getByTestId('v3-timeline-viewer')).toContainText('180s', { timeout: 120_000 });
  const lossScene = draft.getByTestId('v3-chapter-navigator').getByRole('button', { name: /Bề mặt Hàm mất mát|Hàm mất mát & Gradient/ }).first();
  await lossScene.click();
  const inspector = draft.getByTestId('v3-scene-inspector');
  await expect(inspector).toContainText('loss_landscape');
  const preview = inspector.getByTestId('v3-preview-panel');
  await preview.getByRole('button', { name: /Render Preview Frame/ }).click();
  await expect(preview.locator('img')).toBeVisible({ timeout: 60_000 });

  await reviewApproveAndWait(page, request);
});
