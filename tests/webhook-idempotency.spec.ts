import { test, expect } from "@playwright/test"

test.setTimeout(120_000)

test.describe("Webhook Idempotency", () => {
  test("Webhook should handle duplicate events (idempotency)", async ({
    request,
  }) => {
    const payload = {
      id: "evt-fixed-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-1",
        custom_id: "demo-001",
        status: "COMPLETED",
        amount: {
          total: "2.99",
          currency: "USD",
        },
      },
    }

    // First webhook call
    const r1 = await request.post("/api/webhook/paypal", {
      data: payload,
    })

    expect(r1.status()).toBe(200)
    const data1 = await r1.json()
    expect(data1.success).toBe(true)

    // Second webhook call with same event ID (should be idempotent)
    const r2 = await request.post("/api/webhook/paypal", {
      data: payload,
    })

    expect(r2.status()).toBe(200)
    const data2 = await r2.json()
    // Should return success or already_processed
    expect(data2.success || data2.status === "already_processed").toBeTruthy()

    // Verify order was updated (check via orders API)
    const orderRes = await request.get("/api/orders/demo-001")
    if (orderRes.ok()) {
      const { order } = await orderRes.json()
      expect(order?.status).toBe("paid")
    }
  })

  test("Webhook should process different events independently", async ({
    request,
  }) => {
    const payload1 = {
      id: "evt-unique-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-1",
        custom_id: "demo-002",
        status: "COMPLETED",
      },
    }

    const payload2 = {
      id: "evt-unique-2",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-2",
        custom_id: "demo-002",
        status: "COMPLETED",
      },
    }

    // Process first event
    const r1 = await request.post("/api/webhook/paypal", {
      data: payload1,
    })
    expect(r1.status()).toBe(200)

    // Process second event (different ID, should be processed)
    const r2 = await request.post("/api/webhook/paypal", {
      data: payload2,
    })
    expect(r2.status()).toBe(200)
    const data2 = await r2.json()
    expect(data2.success).toBe(true)
  })
})

