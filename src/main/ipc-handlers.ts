import { ipcMain, dialog, shell } from 'electron'
import { fsService } from './fs-service'
import { storeService } from './store'
import {
  ConflictResolution,
  FileEntry,
  DriveInfo,
  FileOperationResult,
  Settings,
  TargetFolderSlot,
  UndoAction
} from '../preload/types'

/**
 * Register all IPC handlers using ipcMain.handle
 */
export function registerIpcHandlers(): void {
  // --- Filesystem Operations ---
  ipcMain.handle('fs:getDrives', async (): Promise<DriveInfo[]> => {
    return await fsService.getDrives()
  })

  ipcMain.handle('fs:getFolderTree', async (_event, dirPath: string): Promise<FileEntry[]> => {
    return await fsService.getFolderTree(dirPath)
  })

  ipcMain.handle(
    'fs:getFolderContents',
    async (
      _event,
      dirPath: string,
      sortBy: 'isDirectory' | 'name' | 'mtime' | 'size' = 'name',
      sortOrder: 'asc' | 'desc' = 'asc'
    ): Promise<FileEntry[]> => {
      return await fsService.getFolderContents(dirPath, sortBy, sortOrder)
    }
  )

  // Alias for getFolderContents to match renderer's readDirectory call
  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string): Promise<FileEntry[]> => {
    return await fsService.getFolderContents(dirPath)
  })

  ipcMain.handle(
    'fs:createFolder',
    async (
      _event,
      parentPath: string,
      folderName: string
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      return await fsService.createFolder(parentPath, folderName)
    }
  )

  ipcMain.handle(
    'fs:renameFile',
    async (
      _event,
      oldPath: string,
      newName: string
    ): Promise<{ success: boolean; newPath?: string; error?: string }> => {
      return await fsService.renameFile(oldPath, newName)
    }
  )

  ipcMain.handle(
    'fs:moveFile',
    async (
      _event,
      sourcePath: string,
      targetDirPath: string,
      resolution: ConflictResolution = 'ask',
      slotNumber?: number
    ): Promise<FileOperationResult> => {
      return await fsService.moveFile(sourcePath, targetDirPath, resolution, slotNumber)
    }
  )

  ipcMain.handle(
    'fs:copyFile',
    async (
      _event,
      sourcePath: string,
      targetDirPath: string,
      resolution: ConflictResolution = 'ask',
      slotNumber?: number
    ): Promise<FileOperationResult> => {
      return await fsService.copyFile(sourcePath, targetDirPath, resolution, slotNumber)
    }
  )

  ipcMain.handle(
    'fs:undoOperation',
    async (
      _event,
      action: UndoAction
    ): Promise<FileOperationResult & { undoneAction?: UndoAction }> => {
      return await fsService.undoOperation(action)
    }
  )

  ipcMain.handle(
    'fs:undoAction',
    async (): Promise<FileOperationResult & { undoneAction?: UndoAction }> => {
      return await fsService.undoLatestAction()
    }
  )

  ipcMain.handle('fs:getUndoHistory', async (): Promise<UndoAction[]> => {
    return storeService.getUndoHistory()
  })

  // --- Configuration & Store Operations ---
  ipcMain.handle('store:getSettings', async (): Promise<Settings> => {
    return storeService.getSettings()
  })

  ipcMain.handle(
    'store:saveSettings',
    async (_event, settings: Partial<Settings>): Promise<boolean> => {
      storeService.saveSettings(settings)
      return true
    }
  )

  ipcMain.handle('store:getPresets', async () => {
    return storeService.getPresets()
  })

  ipcMain.handle('store:savePresets', async (_event, presets) => {
    storeService.savePresets(presets)
    return true
  })

  ipcMain.handle('store:getTargetSlots', async (): Promise<TargetFolderSlot[]> => {
    return storeService.getTargetSlots()
  })

  ipcMain.handle(
    'store:saveTargetSlots',
    async (
      _event,
      slots: TargetFolderSlot[] | Record<number, TargetFolderSlot | null>
    ): Promise<boolean> => {
      storeService.saveTargetSlots(slots)
      return true
    }
  )

  // --- Dialogs ---
  ipcMain.handle('dialog:selectFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Folder',
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // --- Shell Utilities ---
  ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string): Promise<void> => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('shell:openPath', async (_event, filePath: string): Promise<string> => {
    return await shell.openPath(filePath)
  })
}
