import React, { useState, useRef, useEffect } from 'react'
import { Video as VideoIcon } from 'lucide-react'

// Simple in-memory LRU-like thumbnail cache to prevent re-extracting frames
const thumbnailCache = new Map<string, string>()

interface VideoThumbnailProps {
  filePath: string
  mediaSrc: string
  alt: string
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ filePath, mediaSrc, alt }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(thumbnailCache.get(filePath) || null)
  const [loadFailed, setLoadFailed] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    // If already in memory cache, use it immediately
    const cached = thumbnailCache.get(filePath)
    if (cached) {
      setThumbUrl(cached)
      return
    }

    setThumbUrl(null)
    setLoadFailed(false)

    // Hidden lightweight video element to capture first frame
    const video = document.createElement('video')
    videoRef.current = video
    video.src = mediaSrc
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.playsInline = true

    let isCancelled = false

    const handleLoadedData = () => {
      if (isCancelled) return
      // Seek slightly forward to avoid completely black 0.0s frames (e.g. 0.5s or 0.1s)
      const seekTime = Math.min(1.0, video.duration > 2 ? 1.0 : video.duration * 0.2)
      video.currentTime = seekTime || 0.1
    }

    const handleSeeked = () => {
      if (isCancelled) return
      try {
        const canvas = document.createElement('canvas')
        const width = video.videoWidth || 320
        const height = video.videoHeight || 180

        // Scale down thumbnail to save memory (max 320px width)
        const scale = Math.min(1, 320 / width)
        canvas.width = Math.max(1, Math.floor(width * scale))
        canvas.height = Math.max(1, Math.floor(height * scale))

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
          thumbnailCache.set(filePath, dataUrl)
          setThumbUrl(dataUrl)
        }
      } catch (err) {
        console.warn('Failed to extract video thumbnail frame:', err)
        setLoadFailed(true)
      } finally {
        cleanupVideo()
      }
    }

    const handleError = () => {
      if (isCancelled) return
      setLoadFailed(true)
      cleanupVideo()
    }

    const cleanupVideo = () => {
      if (video) {
        video.removeEventListener('loadeddata', handleLoadedData)
        video.removeEventListener('seeked', handleSeeked)
        video.removeEventListener('error', handleError)
        video.removeAttribute('src')
        video.load()
      }
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)

    return () => {
      isCancelled = true
      cleanupVideo()
    }
  }, [filePath, mediaSrc])

  if (thumbUrl && !loadFailed) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group">
        <img
          src={thumbUrl}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
        {/* Play icon overlay */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shadow-lg backdrop-blur-xs">
            <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-0.5" />
          </div>
        </div>
      </div>
    )
  }

  // Fallback while extracting or if extraction fails
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-zinc-900 overflow-hidden">
      <VideoIcon className="w-8 h-8 text-purple-400/80 animate-pulse" />
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
          <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-0.5" />
        </div>
      </div>
    </div>
  )
}
