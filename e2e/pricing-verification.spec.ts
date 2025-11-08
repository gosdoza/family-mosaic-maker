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

test.describe("Pricing Page Verification", () => {
  test.beforeEach(async ({ page }) => {
    await dismissNextOverlay(page)
  })

  test("1️⃣ Tier comparison verification", async ({ page, request }) => {
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

    // Navigate to pricing page with job ID
    await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(1000)

    // Verify tier cards with data-testid
    const freeCard = page.getByTestId("tier-free")
    await expect(freeCard).toBeVisible({ timeout: 5000 })

    // Verify tier copy (robust assertions)
    await expect(freeCard).toContainText(/Low-res/i)
    await expect(freeCard).toContainText(/Watermark/i)

    const premiumCard = page.getByTestId("tier-premium")
    await expect(premiumCard).toBeVisible({ timeout: 5000 })

    // Verify Premium tier copy
    await expect(premiumCard).toContainText(/\$2\.99/)
    await expect(premiumCard).toContainText(/No watermark/i)

    // Verify Premium "Pay with PayPal" button is active
    const payBtn = page.getByTestId("btn-paypal")
    await payBtn.waitFor({ state: "visible" })
    
    // Wait until the button becomes enabled
    await expect(payBtn).toBeEnabled({ timeout: 15000 })
  })

  test("2️⃣ PayPal checkout flow (mock)", async ({ page, request }) => {
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

    // Navigate to pricing page
    await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(1000)

    // Set up network interception for checkout API
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/checkout") && res.request().method() === "POST",
      { timeout: 10000 }
    )

    // Target the correct button and waits
    const payBtn = page.getByTestId("btn-paypal")
    await payBtn.waitFor({ state: "visible" })
    
    // Wait until the button becomes enabled
    await expect(payBtn).toBeEnabled({ timeout: 15000 })

    // Click to pay
    await Promise.all([
      responsePromise,
      payBtn.click(),
    ])

    // Verify API response
    const response = await responsePromise
    expect(response.ok()).toBe(true)
    const responseData = await response.json()
    expect(responseData).toHaveProperty("approvalUrl")
    expect(responseData.approvalUrl).toBe("/results?id=e2e-job-001&paid=1")
  })

  test("3️⃣ Redirect after payment", async ({ page, request }) => {
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

    // Navigate to pricing page
    await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(1000)

    // Target the correct button and waits
    const payBtn = page.getByTestId("btn-paypal")
    await payBtn.waitFor({ state: "visible" })
    
    // Wait until the button becomes enabled
    await expect(payBtn).toBeEnabled({ timeout: 15000 })

    // Click to pay and wait for redirect
    await Promise.all([
      page.waitForURL(/\/results\?id=e2e-job-001&paid=1/, { timeout: 15000 }),
      payBtn.click(),
    ])

    // Verify redirect URL
    const currentUrl = page.url()
    expect(currentUrl).toContain("/results?id=e2e-job-001")
    expect(currentUrl).toContain("paid=1")

    // Wait for results page to load
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)

    // Wait for order status check
    await page.waitForTimeout(7000)

    // Verify post-redirect (poll for paid badge to appear)
    let paidBadgeFound = false
    for (let i = 0; i < 15; i++) {
      const badge = page.getByTestId("results-paid-badge")
      if ((await badge.count()) > 0) {
        paidBadgeFound = true
        break
      }
      await page.waitForTimeout(1000)
    }
    expect(paidBadgeFound).toBe(true)
    
    // Verify Download HD button is enabled (use data-testid for more reliable selection)
    const downloadButton = page.getByTestId("btn-download-hd").first()
    await expect(downloadButton).toBeVisible({ timeout: 10000 })
    
    let downloadEnabled = false
    for (let i = 0; i < 15; i++) {
      const isEnabled = await downloadButton.isEnabled().catch(() => false)
      const ariaDisabled = await downloadButton.getAttribute("aria-disabled").catch(() => "true")
      if (isEnabled && ariaDisabled === "false") {
        downloadEnabled = true
        break
      }
      await page.waitForTimeout(1000)
    }
    expect(downloadEnabled).toBe(true)
  })

  test("4️⃣ Accessibility verification", async ({ page, request }) => {
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

    // Navigate to pricing page
    await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })

    // Wait for page content
    await page.waitForSelector("h1, h2", { timeout: 10000 })
    await dismissNextOverlay(page)
    await page.waitForTimeout(1000)

    // Verify "Pay with PayPal" button has aria-label
    const payBtn = page.getByTestId("btn-paypal")
    await payBtn.waitFor({ state: "visible" })
    await expect(payBtn).toBeEnabled({ timeout: 15000 })
    
    const paypalAriaLabel = await payBtn.getAttribute("aria-label")
    expect(paypalAriaLabel).toBeTruthy()
    expect(paypalAriaLabel).toMatch(/pay|paypal/i)

    // Test keyboard interaction: Focus and press Enter
    await payBtn.focus()
    
    // Set up network interception for checkout API
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/checkout") && res.request().method() === "POST",
      { timeout: 10000 }
    ).catch(() => null)

    // Press Enter to trigger payment
    await page.keyboard.press("Enter")

    // Wait for API call or redirect
    const response = await responsePromise
    if (response) {
      expect(response.ok()).toBe(true)
    } else {
      // Fallback: Check if redirect occurred
      await page.waitForTimeout(2000)
      const currentUrl = page.url()
      if (currentUrl.includes("/results")) {
        expect(currentUrl).toContain("paid=1")
      }
    }

    // Verify Download HD button has aria-label (on results page after redirect)
    if (page.url().includes("/results")) {
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(2000)

      const downloadButton = page.getByTestId("btn-download-hd").first()
      if ((await downloadButton.count()) > 0) {
        const downloadAriaLabel = await downloadButton.getAttribute("aria-label")
        expect(downloadAriaLabel).toBeTruthy()
        expect(downloadAriaLabel).toMatch(/download/i)
      }
    }
  })

  test("5️⃣ Print summary", async ({ page, request }) => {
    console.log("\n=== Pricing Page Verification Summary ===\n")

    const results: { [key: string]: boolean } = {}

    // Test 1: Tier comparison
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/login`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.context().addCookies([
        { name: "__e2e", value: "1", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
      ])

      await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(1000)

      // Verify tier cards with data-testid
      const freeCard = page.getByTestId("tier-free")
      const premiumCard = page.getByTestId("tier-premium")
      const freeCardVisible = (await freeCard.count()) > 0
      const premiumCardVisible = (await premiumCard.count()) > 0
      
      // Verify tier copy (robust assertions)
      const freeText = await freeCard.textContent().catch(() => "")
      const premiumText = await premiumCard.textContent().catch(() => "")
      const freeLowResVisible = freeText?.includes("Low-res") || freeText?.includes("Low-resolution") || false
      const freeWatermarkVisible = freeText?.includes("Watermark") || freeText?.includes("watermark") || false
      const premiumPriceVisible = premiumText?.includes("$2.99") || false
      const premiumNoWatermarkVisible = premiumText?.includes("No watermark") || premiumText?.includes("no watermark") || false
      
      const payBtn = page.getByTestId("btn-paypal")
      const paypalButtonVisible = (await payBtn.count()) > 0
      let paypalButtonEnabled = false
      if (paypalButtonVisible) {
        // Wait for button to be enabled
        for (let i = 0; i < 15; i++) {
          paypalButtonEnabled = await payBtn.isEnabled().catch(() => false)
          if (paypalButtonEnabled) break
          await page.waitForTimeout(1000)
        }
      }

      results["Comparison"] = freeCardVisible && premiumCardVisible && freeLowResVisible && 
                              freeWatermarkVisible && premiumPriceVisible && premiumNoWatermarkVisible && 
                              paypalButtonVisible && paypalButtonEnabled
    } catch (error) {
      results["Comparison"] = false
      console.error("Comparison test failed:", error)
    }

    // Test 2: Pay flow
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(1000)

      const payBtn = page.getByTestId("btn-paypal")
      await payBtn.waitFor({ state: "visible" })
      await expect(payBtn).toBeEnabled({ timeout: 15000 })
      
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/checkout") && res.request().method() === "POST",
        { timeout: 10000 }
      ).catch(() => null)

      await payBtn.click()
      const response = await responsePromise

      const apiCalled = response !== null && response.ok()
      const hasApprovalUrl = response ? (await response.json()).approvalUrl === "/results?id=e2e-job-001&paid=1" : false

      results["Pay flow"] = apiCalled && hasApprovalUrl
    } catch (error) {
      results["Pay flow"] = false
      console.error("Pay flow test failed:", error)
    }

    // Test 3: Redirect
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(1000)

      const payBtn = page.getByTestId("btn-paypal")
      await payBtn.waitFor({ state: "visible" })
      await expect(payBtn).toBeEnabled({ timeout: 15000 })
      
      await Promise.all([
        page.waitForURL(/\/results\?id=e2e-job-001&paid=1/, { timeout: 15000 }),
        payBtn.click(),
      ])

      await page.waitForTimeout(7000)
      
      // Poll for paid badge
      let paidBadgeVisible = false
      for (let i = 0; i < 15; i++) {
        if ((await page.getByTestId("results-paid-badge").count()) > 0) {
          paidBadgeVisible = true
          break
        }
        await page.waitForTimeout(1000)
      }
      
      // Poll for download button to be enabled (use data-testid for more reliable selection)
      const downloadButton = page.getByTestId("btn-download-hd").first()
      let downloadEnabled = false
      if ((await downloadButton.count()) > 0) {
        for (let i = 0; i < 15; i++) {
          const isEnabled = await downloadButton.isEnabled().catch(() => false)
          const ariaDisabled = await downloadButton.getAttribute("aria-disabled").catch(() => "true")
          if (isEnabled && ariaDisabled === "false") {
            downloadEnabled = true
            break
          }
          await page.waitForTimeout(1000)
        }
      }

      results["Redirect"] = paidBadgeVisible && downloadEnabled
    } catch (error) {
      results["Redirect"] = false
      console.error("Redirect test failed:", error)
    }

    // Test 4: A11y
    try {
      await request.post(`${baseURL}/api/test/clear`)
      await request.post(`${baseURL}/api/test/seed`, { data: { makePaid: false } })

      await page.goto("/pricing?job=e2e-job-001", { waitUntil: "domcontentloaded" })
      await page.waitForSelector("h1, h2", { timeout: 10000 })
      await dismissNextOverlay(page)
      await page.waitForTimeout(1000)

      const payBtn = page.getByTestId("btn-paypal")
      await payBtn.waitFor({ state: "visible" })
      await expect(payBtn).toBeEnabled({ timeout: 15000 })
      
      const paypalAriaLabel = await payBtn.getAttribute("aria-label")
      const hasAriaLabel = paypalAriaLabel !== null && paypalAriaLabel.length > 0

      // Test keyboard interaction
      await payBtn.focus()
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/checkout") && res.request().method() === "POST",
        { timeout: 10000 }
      ).catch(() => null)

      await page.keyboard.press("Enter")
      const keyboardWorks = await responsePromise !== null

      results["A11y"] = hasAriaLabel && keyboardWorks
    } catch (error) {
      results["A11y"] = false
      console.error("A11y test failed:", error)
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

