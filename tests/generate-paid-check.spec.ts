import { test, expect } from "@playwright/test"

test.setTimeout(120_000)

test.describe("Generate Page Paid Status Check", () => {
  test("Generate page should not show Paid badge", async ({ page }) => {
    // Navigate to generate page without any query parameters
    await page.goto("/generate")
    await page.waitForLoadState("networkidle")

    // Check if "Paid ✅" badge is visible
    const paidBadge = page.getByText("Paid ✅", { exact: false })
    const count = await paidBadge.count()

    // Should not show paid badge on generate page
    expect(count).toBe(0)

    // Also check URL parameters
    const url = page.url()
    expect(url).not.toContain("paid=1")
    expect(url).not.toContain("paid=")
  })

  test("Generate page should not call orders API", async ({ page }) => {
    const apiCalls: string[] = []

    // Listen for API calls
    page.on("request", (request) => {
      const url = request.url()
      if (url.includes("/api/orders")) {
        apiCalls.push(url)
      }
    })

    await page.goto("/generate")
    await page.waitForLoadState("networkidle")

    // Wait a bit for any async calls
    await page.waitForTimeout(2000)

    // Should not call orders API on generate page
    expect(apiCalls.length).toBe(0)
  })

  test("Generate page should not have paid in URL", async ({ page }) => {
    await page.goto("/generate")
    await page.waitForLoadState("networkidle")

    // Check URL
    const url = page.url()
    const urlParams = new URL(url).searchParams

    // Should not have paid parameter
    expect(urlParams.get("paid")).toBeNull()
  })
})

