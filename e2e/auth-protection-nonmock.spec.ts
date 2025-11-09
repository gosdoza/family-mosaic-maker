import { test, expect } from "@playwright/test"

const baseURL = process.env.BASE_URL || "http://localhost:3000"
const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

/**
 * E2E test for authentication protection in non-mock mode
 * 
 * This test verifies that protected routes redirect to /auth/login
 * when the user is not authenticated (non-mock mode only).
 * 
 * In mock mode, this test is skipped because authentication is bypassed.
 */
test.describe("Auth Protection (Non-Mock Mode)", () => {
  // Skip all tests if mock mode is enabled
  if (isMock) {
    test.skip("Skipping auth protection tests in mock mode", () => {
      console.log("⚠️  Mock mode enabled - skipping auth protection tests")
    })
  }

  test.describe.configure({ retries: 1, timeout: 30_000 })

  test("Protected route /orders redirects to login when not authenticated", async ({
    page,
    request,
  }) => {
    test.skip(isMock, "Skipping in mock mode")

    // Clear any existing cookies/session
    await page.context().clearCookies()

    // Attempt to access protected route
    const response = await request.get(`${baseURL}/orders`, {
      followRedirect: false,
    })

    // Should redirect with 307 status
    expect(response.status()).toBe(307)

    // Should redirect to /auth/login with redirect parameter
    const location = response.headers()["location"]
    expect(location).toBeTruthy()
    expect(location).toContain("/auth/login")
    expect(location).toContain("redirect=/orders")
  })

  test("Protected route /results redirects to login when not authenticated", async ({
    page,
    request,
  }) => {
    test.skip(isMock, "Skipping in mock mode")

    // Clear any existing cookies/session
    await page.context().clearCookies()

    // Attempt to access protected route
    const response = await request.get(`${baseURL}/results`, {
      followRedirect: false,
    })

    // Should redirect with 307 status
    expect(response.status()).toBe(307)

    // Should redirect to /auth/login with redirect parameter
    const location = response.headers()["location"]
    expect(location).toBeTruthy()
    expect(location).toContain("/auth/login")
    expect(location).toContain("redirect=/results")
  })

  test("Protected route /settings redirects to login when not authenticated", async ({
    page,
    request,
  }) => {
    test.skip(isMock, "Skipping in mock mode")

    // Clear any existing cookies/session
    await page.context().clearCookies()

    // Attempt to access protected route
    const response = await request.get(`${baseURL}/settings`, {
      followRedirect: false,
    })

    // Should redirect with 307 status
    expect(response.status()).toBe(307)

    // Should redirect to /auth/login with redirect parameter
    const location = response.headers()["location"]
    expect(location).toBeTruthy()
    expect(location).toContain("/auth/login")
    expect(location).toContain("redirect=/settings")
  })

  test("Public route / is accessible without authentication", async ({
    page,
    request,
  }) => {
    test.skip(isMock, "Skipping in mock mode")

    // Clear any existing cookies/session
    await page.context().clearCookies()

    // Attempt to access public route
    const response = await request.get(`${baseURL}/`, {
      followRedirect: false,
    })

    // Should return 200 (not redirect)
    expect(response.status()).toBe(200)
  })

  test("Public route /pricing is accessible without authentication", async ({
    page,
    request,
  }) => {
    test.skip(isMock, "Skipping in mock mode")

    // Clear any existing cookies/session
    await page.context().clearCookies()

    // Attempt to access public route
    const response = await request.get(`${baseURL}/pricing`, {
      followRedirect: false,
    })

    // Should return 200 (not redirect)
    expect(response.status()).toBe(200)
  })
})

