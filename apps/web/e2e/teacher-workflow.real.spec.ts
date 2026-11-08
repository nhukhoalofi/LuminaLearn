import { expect, test } from '@playwright/test';

test('complete approved topic workflow produces a playable MP4 and subtitles @real-render', async ({ page, request }) => {
  test.setTimeout(360_000);
  await page.goto('/');
  await page.locator('#video-topic').fill('Tổng Riemann và trực giác tích phân của x bình phương trên đoạn từ 0 đến 1');
  await page.locator('#visual-style-select').selectOption('clean_educational_infographic');
  await page.getByRole('button', { name: /Xem trước bản thảo/ }).click();
  await expect(page.getByText(/SymPy Verified/)).toBeVisible();

  const approveResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/approve') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Duyệt bản thảo/ }).click();
  const approveResponse = await approveResponsePromise;
  expect(approveResponse.ok()).toBe(true);
  const approval = await approveResponse.json() as { artifactId: string; job: { jobId: string; status: string } };
  expect(approval.artifactId).toMatch(/^art_draft_[a-f0-9]{32}_v\d+$/);
  expect(approval.job.jobId).toMatch(/^job-/);

  await expect(page.getByText('Video đã hoàn tất')).toBeVisible({ timeout: 300_000 });
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(async () => video.evaluate((element: HTMLVideoElement) => element.duration), {
    timeout: 30_000
  }).toBeGreaterThan(0);

  const videoResponse = await request.get(`/api/jobs/${approval.job.jobId}/video`, {
    headers: { Range: 'bytes=0-1023' }
  });
  expect([200, 206]).toContain(videoResponse.status());
  expect(videoResponse.headers()['content-type']).toContain('video/mp4');
  expect((await videoResponse.body()).byteLength).toBeGreaterThan(0);

  const subtitleResponse = await request.get(`/api/jobs/${approval.job.jobId}/subtitles`);
  expect(subtitleResponse.ok()).toBe(true);
  expect(subtitleResponse.headers()['content-type']).toContain('application/x-subrip');
  expect(await subtitleResponse.text()).toContain('-->');

  const jobResponse = await request.get(`/api/jobs/${approval.job.jobId}`);
  expect(jobResponse.ok()).toBe(true);
  const job = await jobResponse.json() as { jobId: string; status: string; videoUrl: string };
  expect(job.jobId).toBe(approval.job.jobId);
  expect(job.status).toBe('completed');
  expect(job.videoUrl).toContain(approval.job.jobId);
});
