import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import {
  FileEntry,
  DriveInfo,
  ConflictResolution,
  FileOperationResult,
  UndoAction
} from '../preload/types'
import { storeService } from './store'

const execAsync = promisify(exec)

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.avif',
  '.tiff',
  '.tif',
  '.heic',
  '.heif'
])

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mkv',
  '.mov',
  '.avi',
  '.wmv',
  '.m4v',
  '.flv',
  '.mpg',
  '.mpeg',
  '.m4p',
  '.3gp',
  '.ogv',
  '.ts'
])

const EXCLUDED_FOLDERS = new Set([
  'system volume information',
  '$recycle.bin',
  'recovery',
  'perflogs',
  'msocache',
  'config.msi'
])

/**
 * Determine file category type
 */
function getFileType(
  isDirectory: boolean,
  filePath: string
): 'image' | 'video' | 'folder' | 'other' {
  if (isDirectory) return 'folder'
  const ext = path.extname(filePath).toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  return 'other'
}

/**
 * Safely generate a non-conflicting destination path:
 * e.g., "video.mp4" -> "video (1).mp4", "video (2).mp4"
 */
export async function generateNonConflictingPath(targetPath: string): Promise<string> {
  const dir = path.dirname(targetPath)
  const ext = path.extname(targetPath)
  const baseName = path.basename(targetPath, ext)

  let counter = 1
  let candidate = targetPath
  while (true) {
    try {
      await fs.promises.access(candidate)
      candidate = path.join(dir, `${baseName} (${counter})${ext}`)
      counter++
    } catch {
      return candidate
    }
  }
}

/**
 * Perform a cross-device safe move (falls back to copy + delete on EXDEV)
 */
async function safeMoveFileInternal(source: string, destination: string): Promise<void> {
  try {
    await fs.promises.rename(source, destination)
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException
    if (error.code === 'EXDEV' || error.code === 'EPERM' || error.code === 'EBUSY') {
      // Cross-drive or permission issue: copy then unlink
      await fs.promises.copyFile(source, destination)
      await fs.promises.unlink(source)
    } else {
      throw err
    }
  }
}

export class FsService {
  /**
   * Enumerate Windows drives (C:\, D:\, etc.)
   */
  public async getDrives(): Promise<DriveInfo[]> {
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType | ConvertTo-Json"'
        )
        const parsed = JSON.parse(stdout.trim())
        const disks = Array.isArray(parsed) ? parsed : [parsed]

        const drives: DriveInfo[] = []
        for (const disk of disks) {
          if (!disk || !disk.DeviceID) continue
          const driveLetter = disk.DeviceID.toUpperCase()
          const drivePath = `${driveLetter}\\`
          const volumeName = disk.VolumeName ? disk.VolumeName.trim() : ''
          const displayName = volumeName
            ? `${volumeName} (${driveLetter})`
            : driveLetter === 'C:'
              ? `Local Disk (${driveLetter})`
              : `Drive (${driveLetter})`

          drives.push({
            path: drivePath,
            name: displayName
          })
        }

        if (drives.length > 0) {
          return drives
        }
      } catch (err) {
        console.warn('[fs-service] PowerShell drive query failed, falling back to fs scan:', err)
      }

      // Fallback: fast scan letters A-Z
      const fallbackDrives: DriveInfo[] = []
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (const char of letters) {
        const drivePath = `${char}:\\`
        try {
          fs.accessSync(drivePath)
          fallbackDrives.push({
            path: drivePath,
            name: char === 'C' ? `Local Disk (${char}:)` : `Drive (${char}:)`
          })
        } catch {
          // Drive letter not available
        }
      }
      return fallbackDrives
    }

    // Fallback for non-Windows platforms
    return [{ path: '/', name: 'Root (/)' }]
  }

  /**
   * List immediate subdirectories only (folders only, excluding system/hidden folders)
   */
  public async getFolderTree(dirPath: string): Promise<FileEntry[]> {
    try {
      const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const folders: FileEntry[] = []

      for (const dirent of dirents) {
        if (!dirent.isDirectory()) continue

        const nameLower = dirent.name.toLowerCase()
        // Skip system/hidden folders
        if (
          dirent.name.startsWith('$') ||
          dirent.name.startsWith('.') ||
          EXCLUDED_FOLDERS.has(nameLower)
        ) {
          continue
        }

        const fullPath = path.join(dirPath, dirent.name)
        let mtime = 0
        try {
          const stat = await fs.promises.stat(fullPath)
          mtime = stat.mtimeMs
        } catch {
          // Ignored if folder is not accessible
        }

        folders.push({
          name: dirent.name,
          path: fullPath,
          isDirectory: true,
          size: 0,
          mtime,
          extension: '',
          type: 'folder'
        })
      }

      // Natural sort by folder name
      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      return folders
    } catch (err) {
      console.warn(`[fs-service] Could not read folder tree for ${dirPath}:`, err)
      return []
    }
  }

  /**
   * List files and folders with FileEntry metadata.
   * Supports sorting by isDirectory, name, mtime, size.
   */
  public async getFolderContents(
    dirPath: string,
    sortBy: 'isDirectory' | 'name' | 'mtime' | 'size' = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<FileEntry[]> {
    try {
      const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const entries: FileEntry[] = []

      for (const dirent of dirents) {
        // Skip system folders starting with $ or specific hidden files
        const nameLower = dirent.name.toLowerCase()
        if (dirent.name.startsWith('$') || EXCLUDED_FOLDERS.has(nameLower)) {
          continue
        }

        const fullPath = path.join(dirPath, dirent.name)
        const isDir = dirent.isDirectory()
        let size = 0
        let mtime = 0

        try {
          const stat = await fs.promises.stat(fullPath)
          size = isDir ? 0 : stat.size
          mtime = stat.mtimeMs
        } catch {
          // If stat fails (e.g. system file lock), proceed with defaults
        }

        const ext = isDir ? '' : path.extname(dirent.name).replace(/^\./, '').toLowerCase()
        const type = getFileType(isDir, fullPath)

        entries.push({
          name: dirent.name,
          path: fullPath,
          isDirectory: isDir,
          size,
          mtime,
          extension: ext,
          type
        })
      }

      // Sorting
      entries.sort((a, b) => {
        // Folders always take precedence unless explicitly sorting strictly by isDirectory
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1

        let cmp = 0
        if (sortBy === 'name') {
          cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        } else if (sortBy === 'size') {
          cmp = a.size - b.size
        } else if (sortBy === 'mtime') {
          cmp = a.mtime - b.mtime
        } else if (sortBy === 'isDirectory') {
          cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        }

        return sortOrder === 'asc' ? cmp : -cmp
      })

      return entries
    } catch (err) {
      console.error(`[fs-service] Failed to get contents of ${dirPath}:`, err)
      return []
    }
  }

  /**
   * Safely rename a file or directory
   */
  public async renameFile(
    oldPath: string,
    newName: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      const trimmedName = newName.trim()
      if (!trimmedName) {
        return { success: false, error: '이름을 입력해주세요.' }
      }

      if (/[\\/:*?"<>|]/.test(trimmedName)) {
        return {
          success: false,
          error: '이름에 사용할 수 없는 특수문자가 포함되어 있습니다: \\ / : * ? " < > |'
        }
      }

      const dir = path.dirname(oldPath)
      const targetPath = path.join(dir, trimmedName)

      if (path.resolve(oldPath).toLowerCase() !== path.resolve(targetPath).toLowerCase()) {
        try {
          await fs.promises.access(targetPath)
          return { success: false, error: '동일한 이름의 파일이나 폴더가 이미 존재합니다.' }
        } catch {
          // File does not exist, can proceed
        }
      }

      await fs.promises.rename(oldPath, targetPath)
      return { success: true, newPath: targetPath }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  /**
   * Safely create a new directory
   */
  public async createFolder(
    parentPath: string,
    folderName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const trimmed = folderName.trim()
    if (!trimmed) {
      return { success: false, error: 'Folder name cannot be empty' }
    }

    // Windows invalid filename characters: \ / : * ? " < > |
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      return { success: false, error: 'Folder name contains invalid characters' }
    }

    const newPath = path.join(parentPath, trimmed)
    try {
      if (fs.existsSync(newPath)) {
        return { success: false, error: 'Folder already exists' }
      }

      await fs.promises.mkdir(newPath, { recursive: false })
      return { success: true, path: newPath }
    } catch (err: unknown) {
      const error = err as Error
      return { success: false, error: error.message || 'Failed to create folder' }
    }
  }

  /**
   * Move file with conflict resolution ('ask' | 'overwrite' | 'skip' | 'rename')
   */
  public async moveFile(
    sourcePath: string,
    targetDirPath: string,
    resolution: ConflictResolution = 'ask',
    slotNumber?: number
  ): Promise<FileOperationResult> {
    try {
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          action: 'move',
          sourcePath,
          destinationPath: '',
          error: 'Source file does not exist'
        }
      }

      // Ensure target directory exists
      if (!fs.existsSync(targetDirPath)) {
        await fs.promises.mkdir(targetDirPath, { recursive: true })
      }

      const fileName = path.basename(sourcePath)
      const defaultDestPath = path.join(targetDirPath, fileName)
      let finalDestPath = defaultDestPath

      const destinationExists = fs.existsSync(defaultDestPath)
      if (destinationExists) {
        if (resolution === 'ask') {
          return {
            success: false,
            conflict: true,
            action: 'move',
            sourcePath,
            destinationPath: defaultDestPath
          }
        }

        if (resolution === 'skip') {
          return {
            success: true,
            skipped: true,
            action: 'move',
            sourcePath,
            destinationPath: defaultDestPath
          }
        }

        if (resolution === 'rename') {
          finalDestPath = await generateNonConflictingPath(defaultDestPath)
        } else if (resolution === 'overwrite') {
          finalDestPath = defaultDestPath
          try {
            await fs.promises.unlink(finalDestPath)
          } catch {
            // In case target file was locked or already deleted
          }
        }
      }

      await safeMoveFileInternal(sourcePath, finalDestPath)

      // Record in undo history
      const undoAction: UndoAction = {
        id: `move-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'move',
        sourcePath,
        destinationPath: finalDestPath,
        timestamp: Date.now(),
        slotNumber
      }
      storeService.pushUndoAction(undoAction)

      return {
        success: true,
        action: 'move',
        sourcePath,
        destinationPath: finalDestPath
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error(`[fs-service] Move failed for ${sourcePath} -> ${targetDirPath}:`, err)
      return {
        success: false,
        action: 'move',
        sourcePath,
        destinationPath: '',
        error: error.message || 'Move failed'
      }
    }
  }

  /**
   * Copy file with conflict resolution ('ask' | 'overwrite' | 'skip' | 'rename')
   */
  public async copyFile(
    sourcePath: string,
    targetDirPath: string,
    resolution: ConflictResolution = 'ask',
    slotNumber?: number
  ): Promise<FileOperationResult> {
    try {
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          action: 'copy',
          sourcePath,
          destinationPath: '',
          error: 'Source file does not exist'
        }
      }

      if (!fs.existsSync(targetDirPath)) {
        await fs.promises.mkdir(targetDirPath, { recursive: true })
      }

      const fileName = path.basename(sourcePath)
      const defaultDestPath = path.join(targetDirPath, fileName)
      let finalDestPath = defaultDestPath

      const destinationExists = fs.existsSync(defaultDestPath)
      if (destinationExists) {
        if (resolution === 'ask') {
          return {
            success: false,
            conflict: true,
            action: 'copy',
            sourcePath,
            destinationPath: defaultDestPath
          }
        }

        if (resolution === 'skip') {
          return {
            success: true,
            skipped: true,
            action: 'copy',
            sourcePath,
            destinationPath: defaultDestPath
          }
        }

        if (resolution === 'rename') {
          finalDestPath = await generateNonConflictingPath(defaultDestPath)
        } else if (resolution === 'overwrite') {
          finalDestPath = defaultDestPath
        }
      }

      await fs.promises.copyFile(sourcePath, finalDestPath)

      const undoAction: UndoAction = {
        id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'copy',
        sourcePath,
        destinationPath: finalDestPath,
        timestamp: Date.now(),
        slotNumber
      }
      storeService.pushUndoAction(undoAction)

      return {
        success: true,
        action: 'copy',
        sourcePath,
        destinationPath: finalDestPath
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error(`[fs-service] Copy failed for ${sourcePath} -> ${targetDirPath}:`, err)
      return {
        success: false,
        action: 'copy',
        sourcePath,
        destinationPath: '',
        error: error.message || 'Copy failed'
      }
    }
  }

  /**
   * Revert a move (move back to source) or copy (delete created copy file)
   */
  public async undoOperation(
    action: UndoAction
  ): Promise<FileOperationResult & { undoneAction?: UndoAction }> {
    try {
      if (action.type === 'move') {
        if (!fs.existsSync(action.destinationPath)) {
          return {
            success: false,
            action: 'move',
            sourcePath: action.destinationPath,
            destinationPath: action.sourcePath,
            error: 'Target file no longer exists to revert'
          }
        }

        // Ensure source directory exists
        const originalDir = path.dirname(action.sourcePath)
        if (!fs.existsSync(originalDir)) {
          await fs.promises.mkdir(originalDir, { recursive: true })
        }

        // Revert move back to original source path
        await safeMoveFileInternal(action.destinationPath, action.sourcePath)
        storeService.removeUndoAction(action.id)

        return {
          success: true,
          action: 'move',
          sourcePath: action.destinationPath,
          destinationPath: action.sourcePath,
          undoneAction: action
        }
      }

      if (action.type === 'copy') {
        if (fs.existsSync(action.destinationPath)) {
          await fs.promises.unlink(action.destinationPath)
        }
        storeService.removeUndoAction(action.id)

        return {
          success: true,
          action: 'copy',
          sourcePath: action.destinationPath,
          destinationPath: '',
          undoneAction: action
        }
      }

      return {
        success: false,
        action: 'move',
        sourcePath: '',
        destinationPath: '',
        error: 'Unknown undo action type'
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error('[fs-service] Undo operation failed:', err)
      return {
        success: false,
        action: action.type,
        sourcePath: action.destinationPath,
        destinationPath: action.sourcePath,
        error: error.message || 'Undo operation failed'
      }
    }
  }

  /**
   * Undo the latest recorded action from the stack
   */
  public async undoLatestAction(): Promise<FileOperationResult & { undoneAction?: UndoAction }> {
    const latestAction = storeService.popUndoAction()
    if (!latestAction) {
      return {
        success: false,
        action: 'move',
        sourcePath: '',
        destinationPath: '',
        error: 'No actions to undo'
      }
    }

    const result = await this.undoOperation(latestAction)
    if (!result.success) {
      // Push back if failed
      storeService.pushUndoAction(latestAction)
    } else {
      storeService.pushRedoAction(latestAction)
    }
    return result
  }

  /**
   * Redo the latest undone action from the redo stack
   */
  public async redoLatestAction(): Promise<FileOperationResult & { redoneAction?: UndoAction }> {
    const actionToRedo = storeService.popRedoAction()
    if (!actionToRedo) {
      return {
        success: false,
        action: 'move',
        sourcePath: '',
        destinationPath: '',
        error: 'No actions to redo'
      }
    }

    try {
      if (actionToRedo.type === 'move') {
        if (!fs.existsSync(actionToRedo.sourcePath)) {
          return {
            success: false,
            action: 'move',
            sourcePath: actionToRedo.sourcePath,
            destinationPath: actionToRedo.destinationPath,
            error: 'Source file no longer exists to redo move'
          }
        }

        const destDir = path.dirname(actionToRedo.destinationPath)
        if (!fs.existsSync(destDir)) {
          await fs.promises.mkdir(destDir, { recursive: true })
        }

        await safeMoveFileInternal(actionToRedo.sourcePath, actionToRedo.destinationPath)
        const updatedUndo: UndoAction = {
          ...actionToRedo,
          id: `move-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now()
        }
        storeService.pushUndoAction(updatedUndo)

        return {
          success: true,
          action: 'move',
          sourcePath: actionToRedo.sourcePath,
          destinationPath: actionToRedo.destinationPath,
          redoneAction: updatedUndo
        }
      }

      if (actionToRedo.type === 'copy') {
        if (!fs.existsSync(actionToRedo.sourcePath)) {
          return {
            success: false,
            action: 'copy',
            sourcePath: actionToRedo.sourcePath,
            destinationPath: actionToRedo.destinationPath,
            error: 'Source file no longer exists to redo copy'
          }
        }

        const destDir = path.dirname(actionToRedo.destinationPath)
        if (!fs.existsSync(destDir)) {
          await fs.promises.mkdir(destDir, { recursive: true })
        }

        await fs.promises.copyFile(actionToRedo.sourcePath, actionToRedo.destinationPath)
        const updatedUndo: UndoAction = {
          ...actionToRedo,
          id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now()
        }
        storeService.pushUndoAction(updatedUndo)

        return {
          success: true,
          action: 'copy',
          sourcePath: actionToRedo.sourcePath,
          destinationPath: actionToRedo.destinationPath,
          redoneAction: updatedUndo
        }
      }

      return {
        success: false,
        action: 'move',
        sourcePath: '',
        destinationPath: '',
        error: 'Unknown redo action type'
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error('[fs-service] Redo operation failed:', err)
      storeService.pushRedoAction(actionToRedo)
      return {
        success: false,
        action: actionToRedo.type,
        sourcePath: actionToRedo.sourcePath,
        destinationPath: actionToRedo.destinationPath,
        error: error.message || 'Redo operation failed'
      }
    }
  }
}

export const fsService = new FsService()
