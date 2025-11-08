"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, ImageIcon, X } from "lucide-react"
import { useState, useRef } from "react"

interface UploadCardProps {
  onFilesChange: (files: File[]) => void
  uploadedFiles: File[]
  onRemoveFile: (index: number) => void
}

export function UploadCard({ onFilesChange, uploadedFiles, onRemoveFile }: UploadCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    onFilesChange([...uploadedFiles, ...fileArray])
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

  const getImagePreview = (file: File): string => {
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
          <p className="text-muted-foreground mb-6">Drag and drop or click to browse (PNG, JPG, WebP)</p>
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload"
            {...(process.env.NODE_ENV !== "production" ? { "data-testid": "upload-input" } : {})}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleFileInputChange}
          />
          <label htmlFor="file-upload">
            <Button asChild className="rounded-full">
              <span>
                <ImageIcon className="w-4 h-4 mr-2" />
                Choose Files
              </span>
            </Button>
          </label>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden glass group">
                <img
                  src={getImagePreview(file)}
                  alt={`Upload ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => onRemoveFile(idx)}
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

