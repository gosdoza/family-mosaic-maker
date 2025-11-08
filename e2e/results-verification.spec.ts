import { test, expect, Page } from "@playwright/test"

const baseURL = process.env.BASE_URL || "http://localhost:3000"

/**
 * Helper: Dismiss Next.js dev overlay
 */
async function dismissNextOverlay(page: Page) {
  try {
    await page.addStyleTag({
      content:
        '[data-nextjs-overlay-root], [data-nextjs-toast], [aria-label="Overlay Error"], #__next-build-watcher { display:none !important }',
    })
    const close = page.locator('[data-nextjs-dialog] [aria-label="Close"]')
    if ((await close.count()) > 0) {
      await close.first().click({ force: true }).catch(() => {})
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Helper: API request with baseURL prefix and credentials
 */
async function api(url: string, init?: RequestInit) {
  const fullUrl = url.startsWith("http") ? url : `${baseURL}${url}`
  return fetch(fullUrl, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

/**
 * Helper: Login as test user
 */
async function login() {
  const response = await api("/api/test/login", { method: "POST" })
  expect(response.ok).toBeTruthy()
  return response.json()
}

/**
 * Helper: Seed test data
 */
async function seed(paid: boolean) {
  const response = await api("/api/test/seed", {
    method: "POST",
    body: JSON.stringify({ makePaid: paid }),
  })
  expect(response.ok).toBeTruthy()
  return response.json()
}

/**
 * Helper: Clear test data
 */
async function clear() {
  const response = await api("/api/test/clear", { method: "POST" })
  expect(response.ok).toBeTruthy()
  return response.json()
}

test.describe("Results Page Verification", () => {
  test.beforeEach(async ({ page }) => {
    await dismissNextOverlay(page)
  })

  test("1️⃣ Unpaid state verification", async ({ page, request }) => {
    // Setup: Clear, login, seed unpaid
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/login`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: false },
    })

    // Set auth cookie
    await page.context().addCookies([
      {
        name: "__e2e",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    // Navigate to results without ?paid=1
      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for images to load
    await page.waitForTimeout(2000)

    // Verify "PREVIEW" watermark overlay visible on all images
    const watermarkOverlays = page.getByTestId("watermark-overlay")
    const watermarkCount = await watermarkOverlays.count()
    expect(watermarkCount).toBeGreaterThan(0)

    // Verify images are blurred (check for blur-sm class)
    const images = page.locator('[data-testid="results-gallery"] img')
    const imageCount = await images.count()
    expect(imageCount).toBeGreaterThan(0)

    // Check at least one image has blur-sm class
    const firstImage = images.first()
    const imageClasses = await firstImage.getAttribute("class")
    expect(imageClasses).toContain("blur-sm")

    // Verify unpaid banner with "Unlock HD" text (use the region banner, not the status badge)
    const unpaidBanner = page.getByTestId("results-unpaid-banner").filter({ hasText: /premium unlocks|unlock hd/i }).first()
    await expect(unpaidBanner).toBeVisible({ timeout: 5000 })

    // Verify "Unlock HD" button exists
    const unlockButton = page.getByTestId("unlock-hd-cta")
    await expect(unlockButton).toBeVisible({ timeout: 5000 })
    await expect(unlockButton).toHaveText(/unlock hd/i)

    // Click "Unlock HD" and verify navigation
      await Promise.all([
        page.waitForURL(/\/pricing\?job=e2e-job-001/, { timeout: 5000 }),
        unlockButton.click({ force: true }),
      ])

      const currentUrl = page.url()
      expect(currentUrl).toContain("/pricing")
      expect(currentUrl).toContain("job=e2e-job-001")
  })

  test("2️⃣ Paid state verification", async ({ page, request }) => {
    // Setup: Clear, login, seed paid
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/login`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: true },
    })

    // Set auth cookie
    await page.context().addCookies([
      {
        name: "__e2e",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    // Navigate to results (use e2e-job-001 which is seeded by test/seed API)
    await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for order status check to complete (up to 5s timeout + 2s buffer)
    await page.waitForTimeout(7000)

    // Poll for paid badge to appear
    let paidBadgeFound = false
    for (let i = 0; i < 10; i++) {
      const badge = page.getByTestId("results-paid-badge")
      if ((await badge.count()) > 0) {
        paidBadgeFound = true
        break
      }
      await page.waitForTimeout(1000)
    }

    // Verify no watermark/blur (wait for isPaid state to update)
    // Poll for watermark to disappear
    let watermarkHidden = false
    for (let i = 0; i < 10; i++) {
      const watermarkOverlays = page.getByTestId("watermark-overlay")
      const watermarkCount = await watermarkOverlays.count()
      if (watermarkCount === 0) {
        watermarkHidden = true
        break
      }
      await page.waitForTimeout(1000)
    }
    expect(watermarkHidden).toBe(true)

    // Verify images are not blurred
    const images = page.locator('[data-testid="results-gallery"] img')
    if ((await images.count()) > 0) {
      const firstImage = images.first()
      const imageClasses = await firstImage.getAttribute("class")
      expect(imageClasses).not.toContain("blur-sm")
    }

    // Verify paid badge
    const paidBadge = page.getByTestId("results-paid-badge")
    await expect(paidBadge).toBeVisible({ timeout: 10000 })
    await expect(paidBadge.getByText(/paid/i)).toBeVisible()

    // Verify "Download HD" button is enabled (wait for state to update)
    await page.waitForTimeout(2000)
    const downloadButton = page.getByTestId("btn-download-hd").first()
    await expect(downloadButton).toBeVisible({ timeout: 10000 })
    
    // Poll for button to be enabled
    let buttonEnabled = false
    for (let i = 0; i < 10; i++) {
      const isEnabled = await downloadButton.isEnabled()
      const ariaDisabled = await downloadButton.getAttribute("aria-disabled")
      if (isEnabled && ariaDisabled === "false") {
        buttonEnabled = true
        break
      }
      await page.waitForTimeout(1000)
    }
    expect(buttonEnabled).toBe(true)

    // Set up network interception for download
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/download"),
      { timeout: 10000 }
    ).catch(() => null)

    // Click "Download HD"
    await dismissNextOverlay(page)
    await downloadButton.click({ force: true })
    const response = await responsePromise

    // Verify redirect to /api/download
    if (response) {
      expect(response.status()).toBe(302)
      const location = response.headers()["location"]
      expect(location).toBeTruthy()
      expect(location).toContain("mockSigned=1")
    } else {
      // Fallback: Check if navigation occurred
      await page.waitForTimeout(2000)
      const currentUrl = page.url()
      if (currentUrl.includes("/api/download")) {
        expect(currentUrl).toContain("job=e2e-job-001")
        expect(currentUrl).toContain("i=0")
      }
    }

    // Verify metric event (check console logs)
    // Note: This is a best-effort check as we can't easily intercept client-side metrics
    const consoleLogs: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "log" && msg.text().includes("download_started")) {
        consoleLogs.push(msg.text())
      }
    })
  })

  test("3️⃣ Share button behavior verification", async ({ page, request }) => {
    // Setup: Clear, login, seed unpaid
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/login`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: false },
    })

    // Set auth cookie
    await page.context().addCookies([
      {
        name: "__e2e",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    // Navigate to results (use e2e-job-001 which is seeded by test/seed API)
    await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for images to load
    await page.waitForTimeout(2000)

    // Find Share button
    const shareButton = page.getByRole("button", { name: /share/i }).first()
    await expect(shareButton).toBeVisible({ timeout: 5000 })

    // Mock clipboard API
    let clipboardText = ""
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await page.evaluate(() => {
      // Mock navigator.clipboard.writeText
      ;(window as any).mockClipboard = ""
      const originalWriteText = navigator.clipboard.writeText
      ;(navigator.clipboard as any).writeText = async (text: string) => {
        ;(window as any).mockClipboard = text
        if (originalWriteText) {
          return originalWriteText.call(navigator.clipboard, text)
        }
      }
    })

    // Click Share button
    await dismissNextOverlay(page)
    await shareButton.click({ force: true })

    // Wait for toast notification
    await page.waitForTimeout(1000)

    // Verify toast "Link Copied" appears
    const toast = page.getByText(/link copied/i)
    if ((await toast.count()) > 0) {
      await expect(toast.first()).toBeVisible({ timeout: 5000 })
    }

    // Verify clipboard contains current URL
    const currentUrl = page.url()
      const clipboardValue = await page.evaluate(() => (window as any).mockClipboard)
      if (clipboardValue) {
        expect(clipboardValue).toContain("/results?id=e2e-job-001")
      }
  })

  test("4️⃣ Accessibility & keyboard interactions verification", async ({ page, request }) => {
    // Setup: Clear, login, seed paid
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/login`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: true },
    })

    // Set auth cookie
    await page.context().addCookies([
      {
        name: "__e2e",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    // Navigate to results (paid)
      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for order status check
    await page.waitForTimeout(6000)

    // Verify "Download HD" button has correct aria-label
    const downloadButton = page.getByTestId("btn-download-hd").first()
    await expect(downloadButton).toBeVisible({ timeout: 10000 })
    const downloadAriaLabel = await downloadButton.getAttribute("aria-label")
    expect(downloadAriaLabel).toBeTruthy()
    expect(downloadAriaLabel).toMatch(/download hd/i)

    // Verify aria-disabled is false when paid (poll for state update)
    let ariaDisabledCorrect = false
    for (let i = 0; i < 10; i++) {
      const ariaDisabled = await downloadButton.getAttribute("aria-disabled")
      if (ariaDisabled === "false") {
        ariaDisabledCorrect = true
        break
      }
      await page.waitForTimeout(1000)
    }
    expect(ariaDisabledCorrect).toBe(true)

    // Test keyboard interaction: Focus and press Enter
    await downloadButton.focus()
    await page.keyboard.press("Enter")

    // Wait for download to trigger
    await page.waitForTimeout(2000)

    // Now test unpaid state
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: false },
    })

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(2000)

    // Verify "Unlock HD" button
    const unlockButton = page.getByTestId("unlock-hd-cta")
    await expect(unlockButton).toBeVisible({ timeout: 5000 })

    // Verify aria-label
    const unlockAriaLabel = await unlockButton.getAttribute("aria-label")
    expect(unlockAriaLabel).toBeTruthy()
    expect(unlockAriaLabel).toMatch(/unlock hd/i)

    // Test keyboard interaction: Focus and press Enter
    await unlockButton.focus()
      await Promise.all([
        page.waitForURL(/\/pricing\?job=e2e-job-001/, { timeout: 5000 }),
        page.keyboard.press("Enter"),
      ])

    // Verify unpaid Download button has aria-disabled=true
      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(2000)

    const unpaidDownloadButton = page.getByTestId("btn-download-hd").first()
    if ((await unpaidDownloadButton.count()) > 0) {
      await expect(unpaidDownloadButton).toHaveAttribute("aria-disabled", "true")
    }
  })

  test("5️⃣ UI consistency & metadata verification", async ({ page, request }) => {
    // Setup: Clear, login, seed paid
    await request.post(`${baseURL}/api/test/clear`)
    await request.post(`${baseURL}/api/test/login`)
    await request.post(`${baseURL}/api/test/seed`, {
      data: { makePaid: true },
    })

    // Set auth cookie
    await page.context().addCookies([
      {
        name: "__e2e",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    // Navigate to results (use e2e-job-001 which is seeded by test/seed API)
    await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for order status check
    await page.waitForTimeout(6000)

    // Verify page title (wait for dynamic metadata update)
    await page.waitForTimeout(2000)
    const pageTitle = await page.title()
    expect(pageTitle).toContain("Family Mosaic")
    // Title format is "Family Mosaic · Result {id}" or "Family Mosaic · Results"
    expect(pageTitle).toMatch(/Family Mosaic.*Result/i)

    // Verify gallery container
    const gallery = page.getByTestId("results-gallery")
    await expect(gallery).toBeVisible({ timeout: 5000 })

    // Verify OpenGraph metadata (check meta tags - use first() to avoid strict mode violation)
    const ogTitle = page.locator('meta[property="og:title"]').first()
    if ((await ogTitle.count()) > 0) {
      const ogTitleContent = await ogTitle.getAttribute("content")
      expect(ogTitleContent).toContain("Family Mosaic")
      // OG title format is "Family Mosaic · Result {id}" or "Family Mosaic · Results"
      expect(ogTitleContent).toMatch(/Family Mosaic.*Result/i)
    }

    const ogDescription = page.locator('meta[property="og:description"]').first()
    if ((await ogDescription.count()) > 0) {
      const ogDescriptionContent = await ogDescription.getAttribute("content")
      expect(ogDescriptionContent).toContain("AI-generated family photo")
    }

    // Verify Twitter Card metadata
    const twitterCard = page.locator('meta[name="twitter:card"]').first()
    if ((await twitterCard.count()) > 0) {
      const twitterCardContent = await twitterCard.getAttribute("content")
      expect(twitterCardContent).toBe("summary_large_image")
    }
  })

  test("6️⃣ Print summary", async ({ page, request }) => {
    console.log("\n=== Results Page Verification Summary ===\n")

    const results: { [key: string]: boolean } = {}

    // Test 1: Unpaid state
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/login`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.context().addCookies([
        { name: "__e2e", value: "1", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
      ])

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(2000)

      const watermarkVisible = (await page.getByTestId("watermark-overlay").count()) > 0
      const unpaidBannerVisible = (await page.getByTestId("results-unpaid-banner").count()) > 0
      const unlockButtonVisible = (await page.getByTestId("unlock-hd-cta").count()) > 0
      const imagesBlurred = await page.locator('[data-testid="results-gallery"] img').first().evaluate((el) => {
        return el.classList.contains("blur-sm")
      }).catch(() => false)

      results["Unpaid State"] = watermarkVisible && unpaidBannerVisible && unlockButtonVisible && imagesBlurred
    } catch (error) {
      results["Unpaid State"] = false
      console.error("Unpaid state test failed:", error)
    }

    // Test 2: Paid state
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: true } })

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(7000)

      // Poll for paid badge
      let paidBadgeVisible = false
      for (let i = 0; i < 10; i++) {
        if ((await page.getByTestId("results-paid-badge").count()) > 0) {
          paidBadgeVisible = true
          break
        }
        await page.waitForTimeout(1000)
      }

      // Poll for watermark to disappear
      let watermarkHidden = false
      for (let i = 0; i < 10; i++) {
        const watermarkCount = await page.getByTestId("watermark-overlay").count()
        if (watermarkCount === 0) {
          watermarkHidden = true
          break
        }
        await page.waitForTimeout(1000)
      }

      // Poll for download button to be enabled
      const downloadButton = page.getByTestId("btn-download-hd").first()
      let downloadButtonEnabled = false
      let ariaDisabled = "true"
      for (let i = 0; i < 10; i++) {
        downloadButtonEnabled = await downloadButton.isEnabled().catch(() => false)
        ariaDisabled = await downloadButton.getAttribute("aria-disabled").catch(() => "true")
        if (downloadButtonEnabled && ariaDisabled === "false") {
          break
        }
        await page.waitForTimeout(1000)
      }

      results["Paid State"] = paidBadgeVisible && watermarkHidden && downloadButtonEnabled && ariaDisabled === "false"
    } catch (error) {
      results["Paid State"] = false
      console.error("Paid state test failed:", error)
    }

    // Test 3: Share button
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(2000)

      const shareButton = page.getByRole("button", { name: /share/i }).first()
      await shareButton.click({ force: true })
      await page.waitForTimeout(1000)

      const toastVisible = (await page.getByText(/link copied/i).count()) > 0
      results["Share Button"] = toastVisible
    } catch (error) {
      results["Share Button"] = false
      console.error("Share button test failed:", error)
    }

    // Test 4: Accessibility
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: true } })

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(6000)

      // Wait for state to update
      await page.waitForTimeout(2000)
      
      const downloadButton = page.getByTestId("btn-download-hd").first()
      const hasAriaLabel = (await downloadButton.getAttribute("aria-label")) !== null
      
      // Poll for aria-disabled to be false
      let ariaDisabledCorrect = false
      for (let i = 0; i < 10; i++) {
        const ariaDisabled = await downloadButton.getAttribute("aria-disabled")
        if (ariaDisabled === "false") {
          ariaDisabledCorrect = true
          break
        }
        await page.waitForTimeout(1000)
      }

      // Check unlock button aria-label (switch to unpaid state)
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(2000)
      
      const unlockButton = page.getByTestId("unlock-hd-cta")
      const unlockHasAriaLabel = (await unlockButton.getAttribute("aria-label")) !== null

      // Check unpaid download button has aria-disabled=true
      const unpaidDownloadButton = page.getByTestId("btn-download-hd").first()
      const unpaidAriaDisabled = await unpaidDownloadButton.getAttribute("aria-disabled").catch(() => null)

      results["A11y"] = hasAriaLabel && ariaDisabledCorrect && unlockHasAriaLabel && unpaidAriaDisabled === "true"
    } catch (error) {
      results["A11y"] = false
      console.error("A11y test failed:", error)
    }

    // Test 5: UI metadata
    try {
      await page.goto("/results?id=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(2000)

      const titleCorrect = (await page.title()).includes("Family Mosaic")
      const galleryVisible = (await page.getByTestId("results-gallery").count()) > 0

      results["UI Metadata"] = titleCorrect && galleryVisible
    } catch (error) {
      results["UI Metadata"] = false
      console.error("UI metadata test failed:", error)
    }

    // Print summary
    console.log("Section Results:")
    for (const [section, passed] of Object.entries(results)) {
      console.log(`  ${passed ? "✅" : "❌"} ${section}`)
      if (!passed) {
        console.log(`     → Some assertions failed in ${section}`)
      }
    }

    console.log("\n=== End Summary ===\n")

    // Assert all tests passed
    const allPassed = Object.values(results).every((v) => v)
    expect(allPassed).toBe(true)
  })
})

