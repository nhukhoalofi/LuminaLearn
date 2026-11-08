import { test, expect } from '@playwright/test';

test('V3 Perceptron real Web → Draft → Review → Approval → Queue → MP4 @real-render', async ({ page, request }) => {
  test.setTimeout(12 * 60_000);
  await page.goto('/');
  const studio = page.getByTestId('v3-teacher-studio');
  await expect(studio).toContainText('Mock Mode');
  await studio.getByRole('button', { name: 'Tạo bài học V3' }).click();
  const draft = page.getByTestId('v3-draft');
  await expect(draft).toContainText('deterministic_mock');
  await expect(draft).toContainText('Storyboard (35s)');
  await expect(draft).toContainText('human_review_required');
  await draft.getByRole('button', { name: 'Xác nhận rà soát ngữ nghĩa' }).click();
  await expect(draft).toContainText('ready_for_approval');
  await draft.getByRole('button', { name: 'Duyệt & render MP4' }).click();
  const job = page.getByTestId('v3-job');
  await expect(job).toBeVisible();
  await expect(job.getByRole('link', { name: 'Tải MP4 V3' })).toBeVisible({ timeout: 10 * 60_000 });
  const href = await job.getByRole('link', { name: 'Tải MP4 V3' }).getAttribute('href');
  expect(href).toBeTruthy();
  const rangeResponse = await request.get(href!.replace('?download=1', ''), { headers: { Range: 'bytes=0-1023' } });
  expect(rangeResponse.status()).toBe(206);
  expect(rangeResponse.headers()['content-type']).toContain('video/mp4');
  expect((await rangeResponse.body()).byteLength).toBeGreaterThan(0);
});

