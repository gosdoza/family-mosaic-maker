import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  // 優先使用部署環境提供的 commit 資訊
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  const vercelEnv = process.env.VERCEL_ENV // "production" | "preview" | "development"

  // 備援：build 時寫死的版本字串（Cursor 執行時會用 sed 替換）
  const buildInfo = {
    appName: "my-v0-project",
    localCommit: "d0eb2b5",
  }

  return NextResponse.json({
    ok: true,
    source: "app-router",
    environment: vercelEnv ?? "unknown",
    vercelCommit: vercelSha ?? null,
    build: buildInfo,
    now: new Date().toISOString(),
  })
}
