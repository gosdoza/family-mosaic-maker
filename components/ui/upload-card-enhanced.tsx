"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, ImageIcon, X, Loader2 } from "lucide-react"
import { useState, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface UploadCardEnhancedProps {
  onFilesChange: (files: File[]) => void
  uploadedFiles: File[]
  onRemoveFile: (index: number) => void
  onPreviewUrlsChange?: (urls: string[]) => void
}

export function UploadCardEnhanced({
  onFilesChange,
  uploadedFiles,
  onRemoveFile,
  onPreviewUrlsChange,
}: UploadCardEnhancedProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    
    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png"]
    const invalidFiles = fileArray.filter(
      (file) => !allowedTypes.includes(file.type)
    )
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Only JPEG and PNG files are allowed.",
        variant: "destructive",
      })
      return
    }

    // 验证文件大小（8MB）
    const maxSize = 8 * 1024 * 1024
    const oversizedFiles = fileArray.filter((file) => file.size > maxSize)
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: "Each file must be less than 8MB.",
        variant: "destructive",
      })
      return
    }

    // 验证批次大小（5 张）
    if (fileArray.length > 5) {
      toast({
        title: "Too many files",
        description: "Maximum 5 files per batch.",
        variant: "destructive",
      })
      return
    }

    // 开始上传
    setIsUploading(true)
    try {
      await uploadFiles(fileArray)
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const uploadFiles = async (files: File[]) => {
    try {
      // 1. 获取签名 URL
      const response = await fetch("/api/upload/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        
        if (response.status === 401) {
          throw new Error("Please log in to upload files.")
        }
        
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After")
          throw new Error(
            `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
          )
        }
        
        throw new Error(error.error || "Failed to get signed URLs")
      }

      const { signed_urls, request_id } = await response.json()

      // 2. 上传文件到签名 URL
      const uploadedFiles: File[] = []
      const previewUrls: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const signedUrl = signed_urls[i]

        // 上传原图
        const uploadResponse = await fetch(signedUrl.signed_url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        })

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        uploadedFiles.push(file)

        // 3. 生成预览图（使用相同的 request_id）
        const previewResponse = await fetch("/api/upload/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_path: signedUrl.file_path,
            original_file_name: file.name,
            request_id, // 使用相同的 request_id
          }),
        })

        if (!previewResponse.ok) {
          throw new Error(`Failed to generate preview for ${file.name}`)
        }

        const { preview_url } = await previewResponse.json()
        previewUrls.push(preview_url)
      }

      // 4. 更新状态
      onFilesChange([...uploadedFiles])
      setPreviewUrls([...previewUrls])
      if (onPreviewUrlsChange) {
        onPreviewUrlsChange(previewUrls)
      }

      toast({
        title: "Upload successful",
        description: `${uploadedFiles.length} file(s) uploaded.`,
      })
    } catch (error: any) {
      console.error("Upload error:", error)
      throw error
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  const getImagePreview = (file: File, index: number): string => {
    // 如果有预览 URL，使用预览 URL；否则使用本地预览
    if (previewUrls[index]) {
      return previewUrls[index]
    }
    return URL.createObjectURL(file)
  }

  return (
    <Card
      className={`p-8 glass border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-6">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-primary mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Step 1: Upload Portraits</h3>
          <p className="text-muted-foreground mb-6">
            Drag and drop or click to browse (PNG, JPG, max 8MB per file, max 5 files per batch)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload"
            {...(process.env.NODE_ENV !== "production" ? { "data-testid": "upload-input" } : {})}
            className="hidden"
            accept="image/jpeg,image/png"
            multiple
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
          <label htmlFor="file-upload">
            <Button asChild className="rounded-full" disabled={isUploading}>
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose Files
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden glass group">
                <img
                  src={getImagePreview(file, idx)}
                  alt={`Upload ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => {
                    onRemoveFile(idx)
                    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx))
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

