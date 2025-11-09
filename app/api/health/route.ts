import { NextResponse } from "next/server"

export async function GET() {
  return new NextResponse(
    JSON.stringify({ ok: true, time: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0",
      },
    }
  )
}

