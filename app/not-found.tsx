// app/not-found.tsx

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "48px",
        background:
          "linear-gradient(180deg, rgba(245,247,250,0.6), rgba(240,240,245,0.6))",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          borderRadius: 16,
          padding: "28px 24px",
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Page not found</h1>
        <p style={{ margin: "10px 0 18px", lineHeight: 1.6, color: "#555" }}>
          We can't find the page you're looking for. It may have been moved or deleted.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 12,
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.1)",
          }}
          aria-label="Back to Home"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  )
}
