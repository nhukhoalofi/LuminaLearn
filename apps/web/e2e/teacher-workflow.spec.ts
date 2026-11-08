import { expect, test } from '@playwright/test';

async function createTopicDraft(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('#video-topic').fill('Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến');
  await page.locator('#visual-style-select').selectOption('math_chalkboard');
  await page.getByRole('button', { name: /Xem trước bản thảo/ }).click();
  await expect(page.locator('h3').filter({ hasText: /Bản thảo bài học/ })).toBeVisible();
  await expect(page.getByText(/SymPy Verified/)).toBeVisible();
}

test('teacher sees real SymPy rejection, correction, narration and unsaved-edit guard in Chromium', async ({ page }) => {
  await createTopicDraft(page);
  const expression = page.locator('input[aria-label^="Biểu thức"]').first();
  const save = page.getByRole('button', { name: /Lưu chỉnh sửa/ });
  const approve = page.getByRole('button', { name: /Duyệt bản thảo|Không thể duyệt/ });

  await expression.fill('999*x');
  await expect(approve).toBeDisabled();
  await save.click();
  await expect(page.getByText(/Verification Failed/)).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toContainText(/toán|SymPy|mệnh đề/i);
  await expect(approve).toBeDisabled();

  await expression.fill('2*x');
  await save.click();
  await expect(page.getByText(/SymPy Verified/)).toBeVisible();
  await expect(page.locator('textarea[aria-label^="Lời dẫn"]').first()).toBeVisible();
  await expect(page.locator('textarea[aria-label^="Phụ đề"]').first()).toBeVisible();
  await expect(approve).toBeEnabled();

  await page.reload();
  await expect(page.locator('#visual-style-select')).toHaveValue('math_chalkboard');
});

test('document workflow exposes grounded references and rejects unsupported evidence in Chromium', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Document-to-Video/ }).click();
  const documentText = page.locator('textarea[placeholder^="Dán nội dung"]');
  await documentText.fill('Bài đọc đạo hàm. Đạo hàm của x^2 là 3x.');
  await page.getByRole('button', { name: /Phân tích.*Trích xuất/ }).click();
  await expect(page.getByText(/Đã nạp/)).toBeVisible();
  await page.getByRole('button', { name: /Xem trước bản thảo/ }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(/xác minh|toán|SymPy|nguồn/i);

  await documentText.fill('Bài đọc đạo hàm. Đạo hàm của x^2 là 2x.');
  await page.getByRole('button', { name: /Phân tích.*Trích xuất/ }).click();
  await expect(page.getByText(/Đã nạp/)).toBeVisible();
  const draftResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/lessons/draft') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Xem trước bản thảo/ }).click();
  const draftResponse = await draftResponsePromise;
  expect(draftResponse.ok()).toBe(true);
  const groundedDraft = await draftResponse.json() as {
    lessonPlan: { sourceEvidence: Array<{ evidenceFound: boolean; sourceReference: { exactQuote: string } }> }
  };
  expect(groundedDraft.lessonPlan.sourceEvidence.length).toBeGreaterThan(0);
  expect(groundedDraft.lessonPlan.sourceEvidence.every((evidence) => evidence.evidenceFound)).toBe(true);
  expect(groundedDraft.lessonPlan.sourceEvidence[0].sourceReference.exactQuote).toContain('2x');
  await expect(page.getByText(/SymPy Verified/)).toBeVisible();

  const draftId = await page.locator('h3').filter({ hasText: /Bản thảo bài học/ }).evaluate((heading) => {
    const card = heading.closest('div[style*="border-radius: 16px"]');
    return card?.querySelector('h3')?.textContent ?? '';
  });
  expect(draftId).toContain('Bản thảo bài học');

});
