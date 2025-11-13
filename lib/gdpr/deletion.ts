/**
 * GDPR Deletion Service
 * 
 * 实现 GDPR 删除流程：
 * 1. 删除用户的所有数据（Storage + Database）
 * 2. 清理 analytics_logs
 * 3. 在 72 小时内完成
 * 4. 回报结果给用户
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STORAGE_BUCKET_ORIGINALS = process.env.STORAGE_BUCKET_ORIGINALS || "originals"
const STORAGE_BUCKET_PREVIEWS = process.env.STORAGE_BUCKET_PREVIEWS || "previews"
const STORAGE_BUCKET_HD = process.env.STORAGE_BUCKET_HD || "hd"

/**
 * 删除用户的所有 Storage 文件
 */
export async function deleteUserStorage(userId: string): Promise<{
  deleted: number
  errors: number
  details: {
    originals: { deleted: number; errors: number }
    previews: { deleted: number; errors: number }
    hd: { deleted: number; errors: number }
  }
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials")
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const result = {
    deleted: 0,
    errors: 0,
    details: {
      originals: { deleted: 0, errors: 0 },
      previews: { deleted: 0, errors: 0 },
      hd: { deleted: 0, errors: 0 },
    },
  }

  try {
    // 1. 获取用户的所有图片文件路径
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("file_path")
      .eq("user_id", userId)

    if (imagesError) {
      console.error("Error fetching images:", imagesError)
      result.errors++
    } else if (images) {
      // 删除 originals bucket 中的文件
      const originalsPaths = images.map((img) => img.file_path)
      if (originalsPaths.length > 0) {
        const { data: deletedFiles, error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET_ORIGINALS)
          .remove(originalsPaths)

        if (deleteError) {
          console.error("Error deleting originals:", deleteError)
          result.details.originals.errors = originalsPaths.length
          result.errors += originalsPaths.length
        } else {
          result.details.originals.deleted = deletedFiles?.length || 0
          result.deleted += result.details.originals.deleted
        }
      }
    }

    // 2. 获取用户的所有 assets 文件路径
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("file_path, asset_type")
      .eq("user_id", userId)

    if (assetsError) {
      console.error("Error fetching assets:", assetsError)
      result.errors++
    } else if (assets) {
      // 按类型分组
      const previews = assets.filter((a) => a.asset_type === "preview")
      const hd = assets.filter((a) => a.asset_type === "hd")

      // 删除 previews
      if (previews.length > 0) {
        const previewPaths = previews.map((a) => a.file_path)
        const { data: deletedFiles, error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET_PREVIEWS)
          .remove(previewPaths)

        if (deleteError) {
          console.error("Error deleting previews:", deleteError)
          result.details.previews.errors = previewPaths.length
          result.errors += previewPaths.length
        } else {
          result.details.previews.deleted = deletedFiles?.length || 0
          result.deleted += result.details.previews.deleted
        }
      }

      // 删除 HD
      if (hd.length > 0) {
        const hdPaths = hd.map((a) => a.file_path)
        const { data: deletedFiles, error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET_HD)
          .remove(hdPaths)

        if (deleteError) {
          console.error("Error deleting HD:", deleteError)
          result.details.hd.errors = hdPaths.length
          result.errors += hdPaths.length
        } else {
          result.details.hd.deleted = deletedFiles?.length || 0
          result.deleted += result.details.hd.deleted
        }
      }
    }
  } catch (error) {
    console.error("Error in deleteUserStorage:", error)
    result.errors++
  }

  return result
}

/**
 * 删除用户的所有数据库记录
 */
export async function deleteUserDatabaseRecords(userId: string): Promise<{
  deleted: {
    images: number
    assets: number
    orders: number
    analytics_logs: number
    jobs: number
  }
  errors: number
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials")
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const result = {
    deleted: {
      images: 0,
      assets: 0,
      orders: 0,
      analytics_logs: 0,
      jobs: 0,
    },
    errors: 0,
  }

  try {
    // 1. 删除 analytics_logs（物理删除）
    const { error: analyticsError } = await supabase
      .from("analytics_logs")
      .delete()
      .eq("user_id", userId)

    if (analyticsError) {
      console.error("Error deleting analytics_logs:", analyticsError)
      result.errors++
    } else {
      // 获取删除数量（需要先查询）
      const { count } = await supabase
        .from("analytics_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
      // 注意：删除后无法获取数量，这里只是标记
      result.deleted.analytics_logs = 0 // 实际数量无法获取
    }

    // 2. 删除 images（物理删除，因为 Storage 已删除）
    const { error: imagesError } = await supabase
      .from("images")
      .delete()
      .eq("user_id", userId)

    if (imagesError) {
      console.error("Error deleting images:", imagesError)
      result.errors++
    }

    // 3. 删除 assets（物理删除，因为 Storage 已删除）
    const { error: assetsError } = await supabase
      .from("assets")
      .delete()
      .eq("user_id", userId)

    if (assetsError) {
      console.error("Error deleting assets:", assetsError)
      result.errors++
    }

    // 4. 删除 orders（物理删除）
    const { error: ordersError } = await supabase
      .from("orders")
      .delete()
      .eq("user_id", userId)

    if (ordersError) {
      console.error("Error deleting orders:", ordersError)
      result.errors++
    }

    // 5. 删除 jobs（如果存在 jobs 表）
    try {
      const { error: jobsError } = await supabase
        .from("jobs")
        .delete()
        .eq("user_id", userId)

      if (jobsError && !jobsError.message.includes("does not exist")) {
        console.error("Error deleting jobs:", jobsError)
        result.errors++
      }
    } catch (error) {
      // jobs 表可能不存在，忽略错误
    }
  } catch (error) {
    console.error("Error in deleteUserDatabaseRecords:", error)
    result.errors++
  }

  return result
}

/**
 * 执行完整的 GDPR 删除流程
 */
export async function executeGDPRDeletion(
  userId: string,
  requestId: string
): Promise<{
  success: boolean
  storage: Awaited<ReturnType<typeof deleteUserStorage>>
  database: Awaited<ReturnType<typeof deleteUserDatabaseRecords>>
  error?: string
}> {
  try {
    // 1. 删除 Storage
    const storageResult = await deleteUserStorage(userId)

    // 2. 删除数据库记录
    const databaseResult = await deleteUserDatabaseRecords(userId)

    // 3. 删除用户账户（Supabase Auth）
    // 注意：这需要特殊权限，可能需要手动处理
    // 或者通过 Supabase Dashboard 手动删除

    return {
      success: storageResult.errors === 0 && databaseResult.errors === 0,
      storage: storageResult,
      database: databaseResult,
    }
  } catch (error: any) {
    console.error("Error executing GDPR deletion:", error)
    return {
      success: false,
      storage: {
        deleted: 0,
        errors: 0,
        details: {
          originals: { deleted: 0, errors: 0 },
          previews: { deleted: 0, errors: 0 },
          hd: { deleted: 0, errors: 0 },
        },
      },
      database: {
        deleted: {
          images: 0,
          assets: 0,
          orders: 0,
          analytics_logs: 0,
          jobs: 0,
        },
        errors: 0,
      },
      error: error.message,
    }
  }
}



