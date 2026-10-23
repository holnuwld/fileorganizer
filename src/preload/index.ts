import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  FileEntry,
  DriveInfo,
  TargetFolderSlot,
  ConflictResolution,
  Settings,
  UndoAction,
  FileOperationResult,
  PresetConfig
} from './types'

export type CustomElectronAPI = {
  // Drive & Folder queries
  getDrives: () => Promise<DriveInfo[]>
  getFolderTree: (dirPath: string) => Promise<FileEntry[]>
  getFolderContents: (
    dirPath: string,
    sortBy?: 'isDirectory' | 'name' | 'mtime' | 'size',
    sortOrder?: 'asc' | 'desc'
  ) => Promise<FileEntry[]>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>

  // File operations
  createFolder: (
    parentPath: string,
    folderName: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  renameFile: (
    oldPath: string,
    newName: string
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>
  moveFile: (
    sourcePath: string,
    targetDirPath: string,
    resolution?: ConflictResolution,
    slotNumber?: number
  ) => Promise<FileOperationResult>
  copyFile: (
    sourcePath: string,
    targetDirPath: string,
    resolution?: ConflictResolution,
    slotNumber?: number
  ) => Promise<FileOperationResult>

  // Undo engine
  undoOperation: (
    action: UndoAction
  ) => Promise<FileOperationResult & { undoneAction?: UndoAction }>
  undoAction: () => Promise<FileOperationResult & { undoneAction?: UndoAction }>
  getUndoHistory: () => Promise<UndoAction[]>

  // Presets
  getPresets: () => Promise<PresetConfig[]>
  savePresets: (presets: PresetConfig[]) => Promise<boolean>

  // Store & Settings
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Partial<Settings>) => Promise<boolean>
  getTargetSlots: () => Promise<TargetFolderSlot[]>
  saveTargetSlots: (
    slots: TargetFolderSlot[] | Record<number, TargetFolderSlot | null>
  ) => Promise<boolean>

  // Native Dialogs & Shell
  selectFolder: () => Promise<string | null>
  showItemInFolder: (filePath: string) => Promise<void>
  openPath: (filePath: string) => Promise<string>

  // Media helper
  getMediaUrl: (filePath: string) => string
}

// Custom APIs for renderer
export const customApi: CustomElectronAPI = {
  // Drive & Folder queries
  getDrives: (): Promise<DriveInfo[]> => ipcRenderer.invoke('fs:getDrives'),
  getFolderTree: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:getFolderTree', dirPath),
  getFolderContents: (
    dirPath: string,
    sortBy: 'isDirectory' | 'name' | 'mtime' | 'size' = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<FileEntry[]> => ipcRenderer.invoke('fs:getFolderContents', dirPath, sortBy, sortOrder),
  readDirectory: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),

  // File operations
  createFolder: (
    parentPath: string,
    folderName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('fs:createFolder', parentPath, folderName),
  renameFile: (
    oldPath: string,
    newName: string
  ): Promise<{ success: boolean; newPath?: string; error?: string }> =>
    ipcRenderer.invoke('fs:renameFile', oldPath, newName),
  moveFile: (
    sourcePath: string,
    targetDirPath: string,
    resolution: ConflictResolution = 'ask',
    slotNumber?: number
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('fs:moveFile', sourcePath, targetDirPath, resolution, slotNumber),
  copyFile: (
    sourcePath: string,
    targetDirPath: string,
    resolution: ConflictResolution = 'ask',
    slotNumber?: number
  ): Promise<FileOperationResult> =>
    ipcRenderer.invoke('fs:copyFile', sourcePath, targetDirPath, resolution, slotNumber),

  // Undo engine
  undoOperation: (
    action: UndoAction
  ): Promise<FileOperationResult & { undoneAction?: UndoAction }> =>
    ipcRenderer.invoke('fs:undoOperation', action),
  undoAction: (): Promise<FileOperationResult & { undoneAction?: UndoAction }> =>
    ipcRenderer.invoke('fs:undoAction'),
  getUndoHistory: (): Promise<UndoAction[]> => ipcRenderer.invoke('fs:getUndoHistory'),

  // Presets
  getPresets: (): Promise<PresetConfig[]> => ipcRenderer.invoke('store:getPresets'),
  savePresets: (presets: PresetConfig[]): Promise<boolean> =>
    ipcRenderer.invoke('store:savePresets', presets),

  // Store & Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('store:getSettings'),
  saveSettings: (settings: Partial<Settings>): Promise<boolean> =>
    ipcRenderer.invoke('store:saveSettings', settings),
  getTargetSlots: (): Promise<TargetFolderSlot[]> => ipcRenderer.invoke('store:getTargetSlots'),
  saveTargetSlots: (
    slots: TargetFolderSlot[] | Record<number, TargetFolderSlot | null>
  ): Promise<boolean> => ipcRenderer.invoke('store:saveTargetSlots', slots),

  // Native Dialogs & Shell
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:showItemInFolder', filePath),
  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', filePath),

  // Media helper
  getMediaUrl: (filePath: string): string => {
    const normalized = filePath.replace(/\\/g, '/')
    const encoded = encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')
    return `media://local/${encoded}`
  }
}

// Expose safe Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', customApi)
    contextBridge.exposeInMainWorld('api', customApi)
  } catch (error) {
    console.error('[preload] contextBridge error:', error)
  }
} else {
  // @ts-ignore fallback when context isolation is disabled
  window.electron = electronAPI
  // @ts-ignore fallback
  window.electronAPI = customApi
  // @ts-ignore fallback
  window.api = customApi
}
