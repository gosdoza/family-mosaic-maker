import { test, expect } from "@playwright/test"

test("mock generation flow", async ({ page }) => {
  await page.goto("/generate")

  await page.getByRole("button", { name: /Generate Family Photo/i }).click()

  await page.waitForURL("**/progress/demo-001", { timeout: 5000 })

  await page.waitForURL("**/results/demo-001", { timeout: 5000 })

  await expect(page.locator('img[src*="/assets/mock/family"]')).toHaveCount(2)
})

