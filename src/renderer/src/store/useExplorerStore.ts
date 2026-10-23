import { create } from 'zustand'
import { FileEntry, TargetFolderSlot, ExplorerTab, ConflictResolution, PresetConfig } from '../types'
import { useUndoStore } from './useUndoStore'
import { useSettingsStore } from './useSettingsStore'

export type SortColumn = 'name' | 'size' | 'mtime' | 'type'
export type SortDirection = 'asc' | 'desc'

export interface PendingConflict {
  file: FileEntry
  slot: TargetFolderSlot
  isCopy: boolean
  destinationPath: string
}

interface ExplorerState {
  // Tabs
  tabs: ExplorerTab[]
  activeTabId: string

  // Current folder files
  files: FileEntry[]
  selectedFileIndex: number
  selectedFile: FileEntry | null
  selectedFilePaths: Set<string>
  gridColumns: number
  isLoadingFiles: boolean
  sortColumn: SortColumn
  sortDirection: SortDirection

  // Clipboard
  clipboard: { files: FileEntry[]; op: 'copy' | 'cut' } | null
  copyToClipboard: (isCut?: boolean) => void
  pasteFromClipboard: () => Promise<void>

  // Target slots 1-18
  slots: Record<number, TargetFolderSlot | null>
  highlightedSlot: { slotId: number; type: 'move' | 'copy'; timestamp: number } | null
  highlightTimer: ReturnType<typeof setTimeout> | null

  // Conflict Modal State
  pendingConflict: PendingConflict | null

  // Renaming State
  renamingFile: FileEntry | null
  startRename: (file?: FileEntry) => void
  cancelRename: () => void
  commitRename: (newName: string) => Promise<boolean>

  // Methods - Tabs
  addTab: (path?: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setTabPath: (tabId: string, newPath: string) => Promise<void>
  navigateBack: () => Promise<void>
  navigateForward: () => Promise<void>
  refreshCurrentTab: () => Promise<void>
  setTabViewMode: (mode: 'details' | 'grid') => void
  setThumbnailSize: (size: number) => void
  setSort: (column: SortColumn, direction?: SortDirection) => void
  toggleSortDirection: () => void

  // Methods - Files & Multi-selection
  loadDirectory: (dirPath: string) => Promise<void>
  selectFile: (index: number, options?: { toggle?: boolean; range?: boolean }) => void
  selectFileByName: (name: string) => void
  selectAll: () => void
  clearSelection: () => void
  setGridColumns: (cols: number) => void
  navigateGrid: (direction: 'up' | 'down' | 'left' | 'right') => void
  nextFile: () => void
  prevFile: () => void

  // Methods - Target Slots
  loadTargetSlots: () => Promise<void>
  setTargetSlot: (slotId: number, path: string, name?: string) => Promise<void>
  removeTargetSlot: (slotId: number) => Promise<void>
  setHighlightedSlot: (slotId: number, type: 'move' | 'copy') => void

  // File Operations
  moveSelectedFileToSlot: (slotId: number) => Promise<void>
  copySelectedFileToSlot: (slotId: number) => Promise<void>
  resolveConflict: (resolution: ConflictResolution, rememberForSession?: boolean) => Promise<void>
  cancelConflict: () => void

  // Auto-assign folder to next empty slot
  assignSelectedFolderToNextEmptySlot: () => Promise<boolean>

  // Tab navigation helpers
  nextTab: () => void
  prevTab: () => void
  closeCurrentTab: () => void
  reopenLastClosedTab: () => void
  createNewFolderInCurrentTab: (name?: string) => Promise<boolean>

  // Presets Management
  presets: PresetConfig[]
  loadPresets: () => Promise<void>
  saveCurrentAsPreset: (name: string) => Promise<boolean>
  applyPreset: (preset: PresetConfig) => Promise<void>
  deletePreset: (presetId: string) => Promise<void>
}

const initialTabs: ExplorerTab[] = [
  {
    id: 'tab-1',
    path: 'C:\\',
    history: ['C:\\'],
    historyIndex: 0,
    viewMode: 'details',
    thumbnailSize: 120
  }
]

const initialSlots: Record<number, TargetFolderSlot | null> = {
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
  10: null,
  11: null,
  12: null,
  13: null,
  14: null,
  15: null,
  16: null,
  17: null,
  18: null
}

// Closed tabs stack for Ctrl+Shift+T
const closedTabsHistory: string[] = []

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  tabs: initialTabs,
  activeTabId: 'tab-1',

  files: [],
  selectedFileIndex: -1,
  selectedFile: null,
  selectedFilePaths: new Set<string>(),
  gridColumns: 1,
  isLoadingFiles: false,
  sortColumn: 'name',
  sortDirection: 'asc',

  // Clipboard
  clipboard: null,

  slots: initialSlots,
  highlightedSlot: null,
  highlightTimer: null,
  pendingConflict: null,

  // Renaming State
  renamingFile: null,

  startRename: (file) => {
    const target = file || get().selectedFile
    if (target) {
      set({ renamingFile: target })
    }
  },

  cancelRename: () => set({ renamingFile: null }),

  commitRename: async (newName: string) => {
    const { renamingFile, refreshCurrentTab } = get()
    if (!renamingFile || !newName.trim()) {
      set({ renamingFile: null })
      return false
    }

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.renameFile) {
        const res = await window.electronAPI.renameFile(renamingFile.path, newName.trim())
        if (res.success) {
          set({ renamingFile: null })
          await refreshCurrentTab()
          if (res.newPath) {
            get().selectFileByName(newName.trim())
          }
          return true
        } else {
          alert(res.error || '이름 변경에 실패했습니다.')
          return false
        }
      }
    } catch (err) {
      console.error('Rename error:', err)
      alert(String(err))
      return false
    }
    set({ renamingFile: null })
    return false
  },

  // --- Tabs Management ---
  addTab: (path?: string) => {
    const activeTab = get().tabs.find((t) => t.id === get().activeTabId)
    const targetPath = path || activeTab?.path || 'C:\\'
    const newTabId = `tab-${Date.now()}`
    const newTab: ExplorerTab = {
      id: newTabId,
      path: targetPath,
      history: [targetPath],
      historyIndex: 0,
      viewMode: activeTab?.viewMode || 'details',
      thumbnailSize: activeTab?.thumbnailSize || 120
    }

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTabId
    }))

    get().loadDirectory(targetPath)
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1) return // Don't close last tab

    const tabToClose = tabs.find((t) => t.id === tabId)
    if (tabToClose?.path) {
      closedTabsHistory.push(tabToClose.path)
    }

    const newTabs = tabs.filter((t) => t.id !== tabId)
    let newActiveId = activeTabId

    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId)
      const nextTab = newTabs[Math.min(closedIndex, newTabs.length - 1)]
      newActiveId = nextTab.id
      get().loadDirectory(nextTab.path)
    }

    set({ tabs: newTabs, activeTabId: newActiveId })
  },

  setActiveTab: (tabId: string) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return
    set({ activeTabId: tabId })
    get().loadDirectory(tab.path)
  },

  setTabPath: async (tabId: string, newPath: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const newHistory = [...t.history.slice(0, t.historyIndex + 1), newPath]
        return {
          ...t,
          path: newPath,
          history: newHistory,
          historyIndex: newHistory.length - 1
        }
      })
    }))

    if (get().activeTabId === tabId) {
      await get().loadDirectory(newPath)
    }
  },

  navigateBack: async () => {
    const { tabs, activeTabId } = get()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || activeTab.historyIndex <= 0) return

    const newIndex = activeTab.historyIndex - 1
    const prevPath = activeTab.history[newIndex]

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId ? { ...t, path: prevPath, historyIndex: newIndex } : t
      )
    }))

    await get().loadDirectory(prevPath)
  },

  navigateForward: async () => {
    const { tabs, activeTabId } = get()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return

    const newIndex = activeTab.historyIndex + 1
    const nextPath = activeTab.history[newIndex]

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId ? { ...t, path: nextPath, historyIndex: newIndex } : t
      )
    }))

    await get().loadDirectory(nextPath)
  },

  refreshCurrentTab: async () => {
    const activeTab = get().tabs.find((t) => t.id === get().activeTabId)
    if (activeTab) {
      await get().loadDirectory(activeTab.path)
    }
  },

  setTabViewMode: (mode: 'details' | 'grid') => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === state.activeTabId ? { ...t, viewMode: mode } : t))
    }))
  },

  setThumbnailSize: (size: number) => {
    const clamped = Math.max(60, Math.min(260, size))
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId ? { ...t, thumbnailSize: clamped } : t
      )
    }))
  },

  setSort: (column: SortColumn, direction?: SortDirection) => {
    const { sortColumn, sortDirection, files } = get()
    const newDirection =
      direction ?? (sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc')

    const sortedFiles = [...files].sort((a, b) => {
      // Folders always first
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1

      let comp = 0
      if (column === 'name') comp = a.name.localeCompare(b.name, undefined, { numeric: true })
      else if (column === 'size') comp = a.size - b.size
      else if (column === 'mtime') comp = a.mtime - b.mtime
      else if (column === 'type') comp = a.type.localeCompare(b.type)

      return newDirection === 'asc' ? comp : -comp
    })

    const selectedFile = get().selectedFile
    const newSelectedIndex = selectedFile
      ? sortedFiles.findIndex((f) => f.path === selectedFile.path)
      : -1

    set({
      sortColumn: column,
      sortDirection: newDirection,
      files: sortedFiles,
      selectedFileIndex: newSelectedIndex >= 0 ? newSelectedIndex : 0,
      selectedFile: newSelectedIndex >= 0 ? sortedFiles[newSelectedIndex] : sortedFiles[0] || null
    })
  },

  toggleSortDirection: () => {
    const { sortColumn, sortDirection } = get()
    get().setSort(sortColumn, sortDirection === 'asc' ? 'desc' : 'asc')
  },

  // --- Directory & File Listing ---
  loadDirectory: async (dirPath: string) => {
    set({ isLoadingFiles: true })
    try {
      let entries: FileEntry[] = []
      if (typeof window !== 'undefined' && window.electronAPI?.readDirectory) {
        entries = await window.electronAPI.readDirectory(dirPath)
      } else {
        // Fallback placeholder files when electronAPI is not available
        entries = [
          {
            name: 'sample_photo_01.jpg',
            path: `${dirPath}\\sample_photo_01.jpg`,
            isDirectory: false,
            size: 2450000,
            mtime: Date.now() - 3600000,
            extension: 'jpg',
            type: 'image'
          },
          {
            name: 'vacation_clip.mp4',
            path: `${dirPath}\\vacation_clip.mp4`,
            isDirectory: false,
            size: 45600000,
            mtime: Date.now() - 86400000,
            extension: 'mp4',
            type: 'video'
          },
          {
            name: 'Documents',
            path: `${dirPath}\\Documents`,
            isDirectory: true,
            size: 0,
            mtime: Date.now() - 172800000,
            extension: '',
            type: 'folder'
          }
        ]
      }

      // Sort files based on current sort settings
      const { sortColumn, sortDirection } = get()
      const sorted = [...entries].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1

        let comp = 0
        if (sortColumn === 'name') comp = a.name.localeCompare(b.name, undefined, { numeric: true })
        else if (sortColumn === 'size') comp = a.size - b.size
        else if (sortColumn === 'mtime') comp = a.mtime - b.mtime
        else if (sortColumn === 'type') comp = a.type.localeCompare(b.type)

        return sortDirection === 'asc' ? comp : -comp
      })

      const newIndex = sorted.length > 0 ? 0 : -1
      const firstItem = newIndex >= 0 ? sorted[newIndex] : null
      set({
        files: sorted,
        selectedFileIndex: newIndex,
        selectedFile: firstItem,
        selectedFilePaths: firstItem ? new Set([firstItem.path]) : new Set(),
        isLoadingFiles: false
      })
    } catch (err) {
      console.error('Failed to load directory:', err)
      set({
        files: [],
        selectedFileIndex: -1,
        selectedFile: null,
        selectedFilePaths: new Set(),
        isLoadingFiles: false
      })
    }
  },

  selectFile: (index: number, options?: { toggle?: boolean; range?: boolean }) => {
    const { files, selectedFileIndex, selectedFilePaths } = get()
    if (index < 0 || index >= files.length) return
    const targetFile = files[index]

    const newSet = new Set(selectedFilePaths)

    if (options?.toggle) {
      if (newSet.has(targetFile.path)) {
        newSet.delete(targetFile.path)
      } else {
        newSet.add(targetFile.path)
      }
    } else if (options?.range && selectedFileIndex >= 0) {
      const start = Math.min(selectedFileIndex, index)
      const end = Math.max(selectedFileIndex, index)
      for (let i = start; i <= end; i++) {
        newSet.add(files[i].path)
      }
    } else {
      newSet.clear()
      newSet.add(targetFile.path)
    }

    set({
      selectedFileIndex: index,
      selectedFile: targetFile,
      selectedFilePaths: newSet
    })
  },

  selectFileByName: (name: string) => {
    const { files } = get()
    const index = files.findIndex((f) => f.name === name)
    if (index !== -1) {
      get().selectFile(index)
    }
  },

  selectAll: () => {
    const { files } = get()
    const allPaths = new Set(files.map((f) => f.path))
    set({ selectedFilePaths: allPaths })
  },

  clearSelection: () => {
    set({ selectedFilePaths: new Set() })
  },

  setGridColumns: (cols: number) => {
    set({ gridColumns: Math.max(1, cols) })
  },

  navigateGrid: (dir: 'up' | 'down' | 'left' | 'right') => {
    const { files, selectedFileIndex, gridColumns, selectFile } = get()
    if (files.length === 0) return
    const cur = selectedFileIndex >= 0 ? selectedFileIndex : 0
    let nextIdx = cur

    if (dir === 'left') nextIdx = Math.max(0, cur - 1)
    else if (dir === 'right') nextIdx = Math.min(files.length - 1, cur + 1)
    else if (dir === 'up') nextIdx = Math.max(0, cur - gridColumns)
    else if (dir === 'down') nextIdx = Math.min(files.length - 1, cur + gridColumns)

    selectFile(nextIdx)
  },

  nextFile: () => {
    get().navigateGrid('right')
  },

  prevFile: () => {
    get().navigateGrid('left')
  },

  copyToClipboard: (isCut = false) => {
    const { files, selectedFilePaths, selectedFile } = get()
    let targetFiles = files.filter((f) => selectedFilePaths.has(f.path))
    if (targetFiles.length === 0 && selectedFile) {
      targetFiles = [selectedFile]
    }
    if (targetFiles.length === 0) return

    set({
      clipboard: {
        files: targetFiles,
        op: isCut ? 'cut' : 'copy'
      }
    })
  },

  pasteFromClipboard: async () => {
    const { clipboard, tabs, activeTabId, refreshCurrentTab } = get()
    if (!clipboard || clipboard.files.length === 0) return
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || !activeTab.path) return

    const destDir = activeTab.path
    const isCut = clipboard.op === 'cut'

    for (const file of clipboard.files) {
      if (isCut) {
        await window.electronAPI?.moveFile(file.path, destDir, 'rename')
      } else {
        await window.electronAPI?.copyFile(file.path, destDir, 'rename')
      }
    }

    if (isCut) {
      set({ clipboard: null })
    }
    await refreshCurrentTab()
  },

  // --- Target Slots ---
  loadTargetSlots: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getTargetSlots) {
        const slots = await window.electronAPI.getTargetSlots()
        if (slots) {
          set({ slots: { ...initialSlots, ...slots } })
        }
      }
    } catch (e) {
      console.warn('Failed to load target slots from backend:', e)
    }
  },

  setTargetSlot: async (slotId: number, path: string, name?: string) => {
    const folderName = name || path.split('\\').pop() || path.split('/').pop() || path
    const updated = {
      ...get().slots,
      [slotId]: { id: slotId, path, name: folderName }
    }
    set({ slots: updated })

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveTargetSlots) {
        await window.electronAPI.saveTargetSlots(updated)
      }
    } catch (e) {
      console.error('Failed to save target slots:', e)
    }
  },

  removeTargetSlot: async (slotId: number) => {
    const updated = { ...get().slots, [slotId]: null }
    set({ slots: updated })

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveTargetSlots) {
        await window.electronAPI.saveTargetSlots(updated)
      }
    } catch (e) {
      console.error('Failed to save target slots:', e)
    }
  },

  setHighlightedSlot: (slotId: number, type: 'move' | 'copy') => {
    const { highlightTimer } = get()
    if (highlightTimer) {
      clearTimeout(highlightTimer)
    }

    set({
      highlightedSlot: { slotId, type, timestamp: Date.now() },
      highlightTimer: setTimeout(() => {
        set({ highlightedSlot: null, highlightTimer: null })
      }, 1000)
    })
  },

  // --- File Moving / Copying (Supports Batch Multiple Selection) ---
  moveSelectedFileToSlot: async (slotId: number) => {
    const { slots, selectedFile, selectedFileIndex, files, selectedFilePaths } = get()
    const targetSlot = slots[slotId]
    if (!targetSlot) return

    let targetFiles = files.filter((f) => selectedFilePaths.has(f.path))
    if (targetFiles.length === 0 && selectedFile) {
      targetFiles = [selectedFile]
    }
    if (targetFiles.length === 0) {
      console.log(`Slot ${slotId}: no files selected`)
      return
    }

    const policy = useSettingsStore.getState().settings.conflictPolicy
    get().setHighlightedSlot(slotId, 'move')
    const movedPaths = new Set<string>()

    for (const file of targetFiles) {
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.moveFile) {
          const res = await window.electronAPI.moveFile(file.path, targetSlot.path, policy)

          if (res.conflict && policy === 'ask') {
            set({
              pendingConflict: {
                file,
                slot: targetSlot,
                isCopy: false,
                destinationPath: res.destinationPath || targetSlot.path
              }
            })
            break
          }

          if (res.success) {
            movedPaths.add(file.path)
            useUndoStore.getState().pushUndoAction({
              id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'move',
              sourcePath: file.path,
              destinationPath: res.destinationPath,
              timestamp: Date.now(),
              slotNumber: slotId
            })
          }
        } else {
          movedPaths.add(file.path)
        }
      } catch (err) {
        console.error('Failed to move file:', err)
      }
    }

    if (movedPaths.size > 0) {
      const remainingFiles = files.filter((f) => !movedPaths.has(f.path))
      const nextIndex = Math.min(selectedFileIndex, remainingFiles.length - 1)
      const nextFile = nextIndex >= 0 ? remainingFiles[nextIndex] : null

      set({
        files: remainingFiles,
        selectedFileIndex: nextIndex,
        selectedFile: nextFile,
        selectedFilePaths: nextFile ? new Set([nextFile.path]) : new Set()
      })
    }
  },

  copySelectedFileToSlot: async (slotId: number) => {
    const { slots, selectedFile, files, selectedFilePaths } = get()
    const targetSlot = slots[slotId]
    if (!targetSlot) return

    let targetFiles = files.filter((f) => selectedFilePaths.has(f.path))
    if (targetFiles.length === 0 && selectedFile) {
      targetFiles = [selectedFile]
    }
    if (targetFiles.length === 0) return

    const policy = useSettingsStore.getState().settings.conflictPolicy
    get().setHighlightedSlot(slotId, 'copy')

    for (const file of targetFiles) {
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.copyFile) {
          const res = await window.electronAPI.copyFile(file.path, targetSlot.path, policy)

          if (res.conflict && policy === 'ask') {
            set({
              pendingConflict: {
                file,
                slot: targetSlot,
                isCopy: true,
                destinationPath: res.destinationPath || targetSlot.path
              }
            })
            break
          }

          if (res.success) {
            useUndoStore.getState().pushUndoAction({
              id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'copy',
              sourcePath: file.path,
              destinationPath: res.destinationPath,
              timestamp: Date.now(),
              slotNumber: slotId
            })
          }
        }
      } catch (err) {
        console.error('Failed to copy file:', err)
      }
    }
  },

  resolveConflict: async (resolution: ConflictResolution, rememberForSession?: boolean) => {
    const { pendingConflict, files, selectedFileIndex } = get()
    if (!pendingConflict) return

    if (rememberForSession) {
      await useSettingsStore.getState().updateSettings({ conflictPolicy: resolution })
    }

    const { file, slot, isCopy } = pendingConflict
    set({ pendingConflict: null })

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const apiMethod = isCopy ? window.electronAPI.copyFile : window.electronAPI.moveFile
        const res = await apiMethod(file.path, slot.path, resolution)

        if (res.success && !res.skipped) {
          get().setHighlightedSlot(slot.id, isCopy ? 'copy' : 'move')
          useUndoStore.getState().pushUndoAction({
            id: `undo-${Date.now()}`,
            type: isCopy ? 'copy' : 'move',
            sourcePath: file.path,
            destinationPath: res.destinationPath,
            timestamp: Date.now(),
            slotNumber: slot.id
          })

          if (!isCopy) {
            const remainingFiles = files.filter((f) => f.path !== file.path)
            const nextIndex = Math.min(selectedFileIndex, remainingFiles.length - 1)
            set({
              files: remainingFiles,
              selectedFileIndex: nextIndex,
              selectedFile: nextIndex >= 0 ? remainingFiles[nextIndex] : null
            })
          }
        }
      }
    } catch (e) {
      console.error('Error resolving conflict:', e)
    }
  },

  cancelConflict: () => set({ pendingConflict: null }),

  // Assign selected folder to next empty slot (1~18)
  assignSelectedFolderToNextEmptySlot: async () => {
    const { selectedFile, slots, setTargetSlot, setHighlightedSlot } = get()
    if (!selectedFile || !selectedFile.isDirectory) {
      return false
    }

    // Find first empty slot among 1..18
    let emptySlotId: number | null = null
    for (let id = 1; id <= 18; id++) {
      if (!slots[id]) {
        emptySlotId = id
        break
      }
    }

    if (!emptySlotId) {
      alert('타겟 폴더 슬롯(1~18)이 모두 채워져 있습니다. 슬롯을 비우거나 기존 슬롯을 교체해주세요.')
      return false
    }

    await setTargetSlot(emptySlotId, selectedFile.path, selectedFile.name)
    setHighlightedSlot(emptySlotId, 'copy')
    return true
  },

  // Preset management
  presets: [],

  loadPresets: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getPresets) {
        const list = await window.electronAPI.getPresets()
        set({ presets: list || [] })
      } else {
        const local = localStorage.getItem('fast_media_presets')
        if (local) {
          set({ presets: JSON.parse(local) })
        }
      }
    } catch (e) {
      console.error('Failed to load presets:', e)
    }
  },

  saveCurrentAsPreset: async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false

    const { tabs, activeTabId, slots, presets } = get()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    const currentFolderPath = activeTab?.path || 'C:\\'

    const newPreset: PresetConfig = {
      id: `preset-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
      folderPath: currentFolderPath,
      targetSlots: { ...slots }
    }

    const updated = [newPreset, ...presets.filter((p) => p.name !== trimmed)]
    set({ presets: updated })

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.savePresets) {
        await window.electronAPI.savePresets(updated)
      } else {
        localStorage.setItem('fast_media_presets', JSON.stringify(updated))
      }
      return true
    } catch (e) {
      console.error('Failed to save preset:', e)
      return false
    }
  },

  applyPreset: async (preset: PresetConfig) => {
    const { setTabPath, activeTabId } = get()

    // 1. Set current folder path
    if (preset.folderPath) {
      await setTabPath(activeTabId, preset.folderPath)
    }

    // 2. Set target slots
    if (preset.targetSlots) {
      set({ slots: { ...preset.targetSlots } })
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.saveTargetSlots) {
          await window.electronAPI.saveTargetSlots(preset.targetSlots)
        }
      } catch (e) {
        console.error('Failed to persist preset slots:', e)
      }
    }
  },

  deletePreset: async (presetId: string) => {
    const updated = get().presets.filter((p) => p.id !== presetId)
    set({ presets: updated })
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.savePresets) {
        await window.electronAPI.savePresets(updated)
      } else {
        localStorage.setItem('fast_media_presets', JSON.stringify(updated))
      }
    } catch (e) {
      console.error('Failed to delete preset:', e)
    }
  },

  // Tab navigation helpers
  nextTab: () => {
    const { tabs, activeTabId, setActiveTab } = get()
    if (tabs.length <= 1) return
    const curIdx = tabs.findIndex((t) => t.id === activeTabId)
    const nextIdx = (curIdx + 1) % tabs.length
    setActiveTab(tabs[nextIdx].id)
  },

  prevTab: () => {
    const { tabs, activeTabId, setActiveTab } = get()
    if (tabs.length <= 1) return
    const curIdx = tabs.findIndex((t) => t.id === activeTabId)
    const prevIdx = (curIdx - 1 + tabs.length) % tabs.length
    setActiveTab(tabs[prevIdx].id)
  },

  closeCurrentTab: () => {
    const { tabs, activeTabId, closeTab } = get()
    if (tabs.length > 1) {
      closeTab(activeTabId)
    }
  },

  reopenLastClosedTab: () => {
    const lastPath = closedTabsHistory.pop()
    if (lastPath) {
      get().addTab(lastPath)
    }
  },

  createNewFolderInCurrentTab: async (name?: string) => {
    const { tabs, activeTabId, refreshCurrentTab, selectFileByName } = get()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return false

    const defaultName = name || '새 폴더'
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.createFolder) {
        const res = await window.electronAPI.createFolder(activeTab.path, defaultName)
        if (res.success) {
          await refreshCurrentTab()
          selectFileByName(defaultName)
          // Automatically start renaming the new folder
          setTimeout(() => {
            get().startRename()
          }, 100)
          return true
        } else {
          // If already exists, prompt user
          const userInput = window.prompt('폴더 이름을 입력하세요:', defaultName)
          if (userInput && userInput.trim()) {
            const retry = await window.electronAPI.createFolder(activeTab.path, userInput.trim())
            if (retry.success) {
              await refreshCurrentTab()
              selectFileByName(userInput.trim())
              return true
            } else {
              alert(retry.error || '새 폴더 생성에 실패했습니다.')
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
    return false
  }
}))
