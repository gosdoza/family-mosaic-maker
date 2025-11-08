"use client"

import * as React from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("RouteError:", error)
  }, [error])

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        This page crashed
      </h2>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        {process.env.NODE_ENV === "production"
          ? "Please try again."
          : error?.message}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #e2e2e2",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  )
}

