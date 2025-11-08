import { test, expect } from "@playwright/test"

test.setTimeout(120_000)

test("Mock Full Flow: Upload → Generate → Progress → Results → Pricing → Orders", async ({
  page,
}) => {
  // 進入 Generate（帶 e2e=1 以觸發快速通關）
  await page.goto("/generate?e2e=1")
  await page.waitForLoadState("networkidle")

  // 若有上傳欄位就上傳
  const upload = page.getByTestId("upload-input")
  if ((await upload.count()) > 0) {
    await upload.setInputFiles("tests/fixtures/mock.jpg").catch(() => {})
  }

  // 點擊 Generate（e2e=1 模式下應該已經自動跳到步驟 4）
  await page.getByTestId("btn-generate").click()

  // Progress（mock 下會極快跳轉）
  await page.waitForURL("**/progress/**", { timeout: 5_000 })
  await expect(page.getByTestId("progress-page")).toBeVisible({ timeout: 3_000 })

  // Results
  await page.waitForURL("**/results/**", { timeout: 5_000 })
  await expect(page.getByTestId("results-page")).toBeVisible({ timeout: 3_000 })
  await expect(page.getByTestId("result-image")).toHaveCount(2)

  // Pricing：若是同頁區塊，檢查 section；否則導航到 /pricing
  const hasSection = await page.locator('[data-testid="pricing-section"]').count()
  if (hasSection) {
    await expect(page.locator('[data-testid="pricing-section"]')).toBeVisible()
  } else {
    await page.goto("/pricing?e2e=1").catch(() => {})
    await expect(page.getByTestId("pricing-page")).toBeVisible({ timeout: 3_000 })
  }

  // 點 HD CTA（mock 下不必真付）
  const buyHd = page.getByTestId("btn-buy-hd")
  if ((await buyHd.count()) > 0) {
    await buyHd.click().catch(() => {})
  }

  // Orders
  await page.goto("/orders?e2e=1")
  await expect(page.getByTestId("orders-page")).toBeVisible({ timeout: 3_000 })
  const orderItems = page.getByTestId("order-item")
  await expect(orderItems.first()).toBeVisible({ timeout: 3_000 })
})

