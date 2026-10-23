import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Film,
  Image as ImageIcon,
  Clock,
  Sparkles,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'
import { useExplorerStore } from '../store/useExplorerStore'
import { useSettingsStore } from '../store/useSettingsStore'

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const MediaPreview: React.FC = () => {
  const { selectedFile } = useExplorerStore()
  const { settings, setVideoVolume, toggleMute } = useSettingsStore()

  // Video playback states
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)

  // Seek indicator banner (e.g. "+5s", "-15s", "+60s")
  const [seekBanner, setSeekBanner] = useState<{ text: string; id: number } | null>(null)
  const seekBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Codec/Playback error state
  const [videoError, setVideoError] = useState<string | null>(null)

  // Photo viewer states
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0)
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number } | null>(
    null
  )

  // Reset photo zoom/rotation when selectedFile changes
  useEffect(() => {
    setZoomLevel(1)
    setRotation(0)
    setImgNaturalSize(null)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setVideoError(null)
  }, [selectedFile?.path])

  // Custom event listener for keyboard router commands (seek, playPause, muteToggle)
  useEffect(() => {
    const handleMediaCommand = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; seconds?: number }>
      const { action, seconds } = customEvent.detail

      if (!videoRef.current || selectedFile?.type !== 'video') return

      if (action === 'playPause') {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.error)
          setIsPlaying(true)
        } else {
          videoRef.current.pause()
          setIsPlaying(false)
        }
      } else if (action === 'seek' && typeof seconds === 'number') {
        const v = videoRef.current
        const newTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds))
        v.currentTime = newTime
        setCurrentTime(newTime)

        // Show seek indicator banner
        const sign = seconds > 0 ? `+${seconds}s` : `${seconds}s`
        if (seekBannerTimer.current) clearTimeout(seekBannerTimer.current)
        setSeekBanner({ text: sign, id: Date.now() })
        seekBannerTimer.current = setTimeout(() => {
          setSeekBanner(null)
        }, 850)
      }
    }

    window.addEventListener('media-command', handleMediaCommand)
    return () => {
      window.removeEventListener('media-command', handleMediaCommand)
      if (seekBannerTimer.current) clearTimeout(seekBannerTimer.current)
    }
  }, [selectedFile])

  // Update video volume/mute when store settings change
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = settings.videoVolume
      videoRef.current.muted = settings.videoMuted
    }
  }, [settings.videoVolume, settings.videoMuted])

  // Video events
  const handleTimeUpdate = () => {
    if (!isScrubbing && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      videoRef.current.volume = settings.videoVolume
      videoRef.current.muted = settings.videoMuted

      if (settings.autoPlayVideo) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      } else {
        setIsPlaying(false)
      }
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error)
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Interactive Timeline Scrubbing
  const handleTimelineSeek = (clientX: number) => {
    if (!timelineRef.current || !videoRef.current || duration <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const seekTo = pos * duration
    videoRef.current.currentTime = seekTo
    setCurrentTime(seekTo)
  }

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true)
    handleTimelineSeek(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleTimelineSeek(moveEvent.clientX)
    }

    const handleMouseUp = () => {
      setIsScrubbing(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!selectedFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 p-6 text-zinc-500 text-center select-none">
        <Film className="w-12 h-12 stroke-[1.2] text-zinc-700 mb-3" />
        <p className="text-sm font-medium text-zinc-400">선택된 미디어가 없습니다</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-xs leading-relaxed">
          폴더 목록에서 사진이나 동영상을 선택하면 즉시 고화질 미리보기가 지원됩니다.
        </p>
        <div className="mt-6 flex flex-col gap-1.5 text-[11px] text-zinc-500 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 text-left">
          <div>
            <span className="text-blue-400 font-mono">1 ~ 9</span> : 타겟 폴더로 즉시 이동
          </div>
          <div>
            <span className="text-emerald-400 font-mono">Ctrl + 1 ~ 9</span> : 타겟 폴더로 복사
          </div>
          <div>
            <span className="text-zinc-300 font-mono">Space</span> : 동영상 재생 / 일시정지
          </div>
          <div>
            <span className="text-zinc-300 font-mono">Ctrl/Shift + ←/→</span> : 시간 건너뛰기
          </div>
        </div>
      </div>
    )
  }

  const mediaUrl =
    typeof window !== 'undefined' && window.electronAPI?.getMediaUrl
      ? window.electronAPI.getMediaUrl(selectedFile.path)
      : `media://local/${encodeURI(selectedFile.path.replace(/\\/g, '/'))}`

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 select-none overflow-hidden relative">
      {/* Top Header info */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2 truncate">
          {selectedFile.type === 'image' ? (
            <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : selectedFile.type === 'video' ? (
            <Film className="w-4 h-4 text-purple-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-zinc-400 shrink-0" />
          )}
          <span className="font-medium text-zinc-200 truncate" title={selectedFile.name}>
            {selectedFile.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* External Player / App Button */}
          <button
            type="button"
            onClick={() => window.electronAPI?.openPath(selectedFile.path)}
            title="Windows 기본 프로그램으로 열기 (팟플레이어, VLC 등)"
            className="focus-guard flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] transition border border-zinc-700/60"
          >
            <ExternalLink className="w-3 h-3 text-blue-400" />
            <span>외부 열기</span>
          </button>

          {/* Image Controls toolbar */}
          {selectedFile.type === 'image' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
                title="확대 (Zoom In)"
                className="focus-guard p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="축소 (Zoom Out)"
                className="focus-guard p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1)
                  setRotation(0)
                }}
                title="원래 크기 맞춤"
                className="focus-guard p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="90도 회전"
                className="focus-guard p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Preview Center Canvas */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/40">
        {selectedFile.type === 'image' ? (
          <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
            <img
              src={mediaUrl}
              alt={selectedFile.name}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out'
              }}
              className="max-w-full max-h-full object-contain pointer-events-auto"
              onLoad={(e) => {
                const img = e.currentTarget
                setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
              }}
            />
          </div>
        ) : selectedFile.type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {videoError ? (
              <div className="flex flex-col items-center justify-center p-6 text-center gap-3 max-w-sm">
                <AlertTriangle className="w-10 h-10 text-amber-400 animate-bounce" />
                <p className="text-xs text-zinc-300 font-medium">
                  {videoError}
                </p>
                <p className="text-[11px] text-zinc-500">
                  HEVC/H.265 또는 특수 코덱 영상은 PC에 설치된 외부 전용 플레이어(팟플레이어, VLC 등)에서 최적 화질로 재생할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => window.electronAPI?.openPath(selectedFile.path)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>기본 동영상 플레이어로 열기</span>
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={mediaUrl}
                onClick={togglePlay}
                onError={() =>
                  setVideoError(
                    '이 동영상 코덱(HEVC/MKV 등)은 브라우저 내장 플레이어에서 직접 재생을 지원하지 않습니다.'
                  )
                }
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-pointer"
              />
            )}

            {/* Visual Seek Indicator Banner (e.g. +5s, -15s, +60s) */}
            {seekBanner && (
              <div
                key={seekBanner.id}
                className="absolute top-8 px-4 py-2 rounded-xl bg-black/85 border border-white/20 text-white font-mono font-bold text-lg backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-75 duration-100 flex items-center gap-2 pointer-events-none z-30"
              >
                <Clock className="w-5 h-5 text-blue-400" />
                <span>{seekBanner.text}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
            <Sparkles className="w-8 h-8 text-zinc-600" />
            <span className="text-xs">미리보기를 지원하지 않는 형식입니다</span>
          </div>
        )}
      </div>

      {/* Video Player Bottom Control Bar */}
      {selectedFile.type === 'video' && (
        <div className="bg-zinc-900/90 border-t border-zinc-800 p-2.5 flex flex-col gap-2">
          {/* Timeline Bar */}
          <div
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
            className="focus-guard relative h-2 bg-zinc-800 rounded-full cursor-pointer hover:h-2.5 transition-all group"
          >
            {/* Progress filled bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* Scrubber thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-xs">
            {/* Play/Pause & Time */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className="focus-guard p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition shadow"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>

              <span className="font-mono text-[11px] text-zinc-300">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            {/* Volume & Mute Controls (persisted) */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="focus-guard p-1 rounded text-zinc-400 hover:text-zinc-200 transition"
              >
                {settings.videoMuted || settings.videoVolume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.videoMuted ? 0 : settings.videoVolume}
                onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                className="focus-guard w-20 accent-blue-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer Info Metadata (Resolution, Size) */}
      <div className="px-3 py-1 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        {selectedFile.type === 'image' && imgNaturalSize && (
          <span>
            {imgNaturalSize.width} × {imgNaturalSize.height} px ({Math.round(zoomLevel * 100)}%)
          </span>
        )}
        {selectedFile.type === 'video' && duration > 0 && (
          <span>총 길이: {formatDuration(duration)}</span>
        )}
        <span>{selectedFile.extension?.toUpperCase() || selectedFile.type}</span>
      </div>
    </div>
  )
}
