"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // 注意：全域錯誤頁需要自己輸出 <html><body>
  // 不使用任何 React hooks 或 context，避免構建時錯誤
  return (
    <html lang="en">
      <body style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.8, marginBottom: 16 }}>
            {typeof window !== "undefined" && process.env.NODE_ENV === "production"
              ? "An unexpected error occurred. Please try again."
              : error?.message || "An unexpected error occurred"}
          </p>
          {error?.digest ? (
            <code
              style={{
                display: "inline-block",
                padding: "6px 10px",
                background: "#f5f5f5",
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              digest: {error.digest}
            </code>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e2e2e2",
                background: "#fff",
                cursor: "pointer",
              }}
              aria-label="Try again"
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e2e2e2",
                background: "#fff",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              Back to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}

