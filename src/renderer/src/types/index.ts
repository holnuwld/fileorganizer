export type FileEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: number // timestamp
  extension: string
  type: 'image' | 'video' | 'folder' | 'other'
}

export type DriveInfo = {
  path: string
  name: string
}

export type TargetFolderSlot = {
  id: number // 1 ~ 18
  path: string
  name: string
}

export type ConflictResolution = 'ask' | 'overwrite' | 'skip' | 'rename'

export type PresetConfig = {
  id: string
  name: string
  createdAt: number
  folderPath: string
  targetSlots: Record<number, TargetFolderSlot | null>
}

export type Settings = {
  // Appearance
  theme: 'dark' | 'light'

  // Video settings
  autoPlayVideo: boolean
  videoMuted: boolean
  videoVolume: number // 0 ~ 1
  seekSecCtrl: number // X sec (default: 5)
  seekSecShift: number // Y sec (default: 15)
  seekSecCtrlAlt: number // Z sec (default: 60)

  // File operations
  conflictPolicy: ConflictResolution

  // Custom hotkeys (key strings, e.g., '1', 'Ctrl+1', 'Space', 'F2', etc.)
  hotkeys: {
    moveSlot1: string
    moveSlot2: string
    moveSlot3: string
    moveSlot4: string
    moveSlot5: string
    moveSlot6: string
    moveSlot7: string
    moveSlot8: string
    moveSlot9: string
    moveSlot10: string
    moveSlot11: string
    moveSlot12: string
    moveSlot13: string
    moveSlot14: string
    moveSlot15: string
    moveSlot16: string
    moveSlot17: string
    moveSlot18: string
    copySlot1: string
    copySlot2: string
    copySlot3: string
    copySlot4: string
    copySlot5: string
    copySlot6: string
    copySlot7: string
    copySlot8: string
    copySlot9: string
    copySlot10: string
    copySlot11: string
    copySlot12: string
    copySlot13: string
    copySlot14: string
    copySlot15: string
    copySlot16: string
    copySlot17: string
    copySlot18: string
    playPause: string
    muteToggle: string
    undo: string
    redo: string
    rename: string
    refresh: string
    assignNextSlot: string
  }
}

export type UndoAction = {
  id: string
  type: 'move' | 'copy'
  sourcePath: string
  destinationPath: string
  timestamp: number
  slotNumber?: number
}

export type FileOperationResult = {
  success: boolean
  action: 'move' | 'copy'
  sourcePath: string
  destinationPath: string
  error?: string
  skipped?: boolean
  conflict?: boolean
}

export type ExplorerTab = {
  id: string
  path: string
  history: string[]
  historyIndex: number
  viewMode: 'details' | 'grid'
  thumbnailSize: number // e.g. 60 ~ 240
}
