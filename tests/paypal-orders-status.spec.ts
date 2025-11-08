import { test, expect } from "@playwright/test"

test.setTimeout(120_000)

test.describe("PayPal Orders Status", () => {
  test("Results page honors server order status (without paid=1)", async ({
    page,
  }) => {
    // First, create an order via checkout (this will create a paid order in mock mode)
    await page.goto("/pricing")
    await page.waitForLoadState("networkidle")

    // Click PayPal button to create order
    const payButton = page.getByTestId("btn-buy-hd")
    await payButton.click()

    // Wait for redirect to results page
    await page.waitForURL("**/results/**", { timeout: 5000 })
    const currentUrl = page.url()
    const jobId = currentUrl.match(/\/results\/([^?]+)/)?.[1] || "demo-001"

    // Now navigate to results page without paid=1 parameter
    await page.goto(`/results/${jobId}`)
    await page.waitForLoadState("networkidle")

    // Wait for order status to load from backend
    await page.waitForTimeout(2000)

    // Verify "Paid ✅" is visible (because mock checkout creates paid order)
    await expect(page.getByText("Paid ✅", { exact: false })).toBeVisible({
      timeout: 5000,
    })

    // Verify mock images are rendered
    const images = page.getByTestId("result-image")
    await expect(images).toHaveCount(2)
  })

  test("Results page shows unpaid status when order doesn't exist", async ({
    page,
  }) => {
    // Navigate to results page with a jobId that has no order
    await page.goto("/results/non-existent-job")
    await page.waitForLoadState("networkidle")

    // Wait for order status check
    await page.waitForTimeout(2000)

    // Verify unpaid status is shown
    await expect(
      page.getByText("Upgrade to Premium", { exact: false })
    ).toBeVisible({ timeout: 5000 })
  })
})

