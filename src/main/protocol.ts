import { protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

export const MEDIA_SCHEME = 'media'

/**
 * Register scheme privileges for media://
 * MUST be called before app.whenReady()
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

/**
 * Safely converts a media:// URL back to a local Windows file path.
 * Example: media://local/C:/Users/user/video.mp4 -> C:\Users\user\video.mp4
 */
export function mediaUrlToFilePath(mediaUrl: string): string {
  // If format starts with media://C:/ or media://D:/ (where drive letter follows immediately)
  if (/^media:\/\/[a-zA-Z]:/i.test(mediaUrl)) {
    const raw = mediaUrl.slice('media://'.length)
    try {
      return path.normalize(decodeURIComponent(raw))
    } catch {
      return path.normalize(raw)
    }
  }

  try {
    const url = new URL(mediaUrl)

    // If host is a drive letter (e.g. media://C:/path where url.hostname is "c" or "c:")
    if (/^[a-zA-Z]:?$/i.test(url.hostname)) {
      const drive = url.hostname.endsWith(':') ? url.hostname : url.hostname + ':'
      let rest = url.pathname
      try {
        rest = decodeURIComponent(url.pathname)
      } catch {
        // Keep raw rest
      }
      return path.normalize(drive + rest)
    }

    let p = url.pathname
    try {
      p = decodeURIComponent(url.pathname)
    } catch {
      // Use raw pathname if decodeURIComponent fails
    }

    // Remove leading slash if path is like /C:/...
    if (/^\/[a-zA-Z]:/i.test(p)) {
      p = p.slice(1)
    }

    return path.normalize(p)
  } catch {
    // Fallback for non-standard or malformed media URLs
    const stripped = mediaUrl
      .replace(/^media:\/\/local\//i, '')
      .replace(/^media:\/\/\//i, '')
      .replace(/^media:\/\//i, '')
    let decoded = stripped
    try {
      decoded = decodeURIComponent(stripped)
    } catch {
      // Keep stripped raw if decodeURIComponent fails
    }
    return path.normalize(decoded)
  }
}

/**
 * Converts a local Windows file path to a media:// URL.
 * Example: C:\Users\user\video.mp4 -> media://local/C:/Users/user/video.mp4
 */
export function filePathToMediaUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')
  return `${MEDIA_SCHEME}://local/${encoded}`
}

/**
 * MIME type mapping for images, videos, and audio
 */
const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/webm', // Chromium plays webm/vp8/vp9/h264 in mkv containers well with video/webm or video/mp4
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/mp4',
  '.ogv': 'video/ogg',
  '.ts': 'video/mp2t',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac'
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * Registers protocol handler for media://
 * Enables Range request streaming for smooth video seeking and instant image rendering.
 */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const filePath = mediaUrlToFilePath(request.url)

      // Verify file existence and type
      let stat: fs.Stats
      try {
        stat = await fs.promises.stat(filePath)
      } catch {
        return new Response('File Not Found', { status: 404 })
      }

      if (stat.isDirectory()) {
        return new Response('Directory cannot be streamed as media', { status: 400 })
      }

      const fileSize = stat.size
      const mimeType = getMimeType(filePath)
      const rangeHeader = request.headers.get('Range') || request.headers.get('range')

      // Handle HTTP Range Requests (206 Partial Content) for videos/audio
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
          return new Response('Requested Range Not Satisfiable', {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
              'Accept-Ranges': 'bytes'
            }
          })
        }

        const chunkSize = end - start + 1
        const stream = fs.createReadStream(filePath, { start, end })
        // Prevent uncaught stream error crashes
        stream.on('error', (err) => {
          console.error('[media-protocol] Stream error on range request:', err)
        })

        const webStream = Readable.toWeb(stream) as ReadableStream

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      // Direct streaming (200 OK) for images or full media loads
      const stream = fs.createReadStream(filePath)
      stream.on('error', (err) => {
        console.error('[media-protocol] Stream error on full request:', err)
      })

      const webStream = Readable.toWeb(stream) as ReadableStream

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (err) {
      console.error('[media-protocol] Internal error:', err)
      return new Response('Internal Protocol Error', { status: 500 })
    }
  })
}
