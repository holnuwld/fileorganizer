import { useEffect } from 'react'
import { useExplorerStore } from '../store/useExplorerStore'
import { useUndoStore } from '../store/useUndoStore'
import { useSettingsStore } from '../store/useSettingsStore'

/**
 * Normalizes keyboard event to a clean combination string like "Ctrl+Shift+1" or "F2"
 */
export function eventToKeyString(e: KeyboardEvent): string {
  // If only modifier is pressed, don't generate binding yet
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return ''
  }

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')

  let key = e.key
  const shiftDigitMap: Record<string, string> = {
    '!': '1',
    '@': '2',
    '#': '3',
    '$': '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0'
  }

  if (key === ' ') {
    key = 'Space'
  } else if (/^Digit([0-9])$/.test(e.code)) {
    key = e.code.replace('Digit', '')
  } else if (/^Numpad([0-9])$/.test(e.code)) {
    key = e.code.replace('Numpad', '')
  } else if (shiftDigitMap[key]) {
    key = shiftDigitMap[key]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  parts.push(key)
  return parts.join('+')
}

export function matchesBinding(e: KeyboardEvent, binding?: string): boolean {
  if (!binding) return false
  const current = eventToKeyString(e)
  return current.toLowerCase() === binding.trim().toLowerCase()
}

export function useKeyboardRouter() {
  const {
    selectedFile,
    navigateGrid,
    moveSelectedFileToSlot,
    copySelectedFileToSlot,
    selectAll,
    copyToClipboard,
    pasteFromClipboard,
    pendingConflict,
    startRename,
    refreshCurrentTab,
    assignSelectedFolderToNextEmptySlot,
    nextTab,
    prevTab,
    closeCurrentTab,
    reopenLastClosedTab,
    addTab,
    createNewFolderInCurrentTab
  } = useExplorerStore()

  const { triggerUndo, triggerRedo } = useUndoStore()
  const { settings, isSettingsOpen } = useSettingsStore()

  useEffect(() => {
    // Focus guard: ensure clicking controls (sliders, buttons) doesn't trap keyboard navigation
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // If clicked element is inside interactive preview or toolbar, blur after click
      if (
        target.closest('.focus-guard') ||
        target.tagName === 'BUTTON' ||
        (target.tagName === 'INPUT' && target.getAttribute('type') === 'range')
      ) {
        requestAnimationFrame(() => {
          if (document.activeElement && document.activeElement !== document.body) {
            ;(document.activeElement as HTMLElement).blur()
          }
        })
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If any text input, textarea, or select is active, do not intercept
      const activeEl = document.activeElement
      if (
        activeEl &&
        ((activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'text') ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return
      }

      // 2. If Settings modal or Conflict modal is open, let modals handle their keys or Escape
      if (isSettingsOpen || pendingConflict) {
        return
      }

      const hotkeys = settings.hotkeys

      // 3. F2 / Rename Hotkey
      if (matchesBinding(e, hotkeys.rename || 'F2')) {
        e.preventDefault()
        startRename()
        return
      }

      // 3-1. Ctrl+N: Create New Folder in Current Tab
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        createNewFolderInCurrentTab()
        return
      }

      // 3-2. Tab Navigation Hotkeys:
      // Ctrl+Shift+T: Reopen last closed tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        reopenLastClosedTab()
        return
      }

      // Ctrl+T: Open new tab
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        addTab()
        return
      }

      // Ctrl+W: Close current tab
      if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        closeCurrentTab()
        return
      }

      // Ctrl+Shift+Tab: Previous tab (left)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        prevTab()
        return
      }

      // Shift+Tab: Next tab (right)
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'Tab') {
        e.preventDefault()
        nextTab()
        return
      }

      // 4. F5 / Refresh Hotkey
      if (matchesBinding(e, hotkeys.refresh || 'F5')) {
        e.preventDefault()
        refreshCurrentTab()
        return
      }

      // 4-1. Assign Folder to Next Empty Slot (Default: Ctrl+ArrowUp)
      if (matchesBinding(e, hotkeys.assignNextSlot || 'Ctrl+ArrowUp')) {
        e.preventDefault()
        assignSelectedFolderToNextEmptySlot()
        return
      }

      // 5. Undo Hotkey (Default: Ctrl+Z)
      if (matchesBinding(e, hotkeys.undo || 'Ctrl+Z')) {
        e.preventDefault()
        triggerUndo()
        return
      }

      // 5-1. Redo Hotkey (Default: Ctrl+Y or Ctrl+Shift+Z)
      if (
        matchesBinding(e, hotkeys.redo || 'Ctrl+Y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault()
        triggerRedo()
        return
      }

      // 5-2. Ctrl+A: Select All Files in Folder
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        selectAll()
        return
      }

      // 5-3. Ctrl+C: Copy Selected Files to Clipboard
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        copyToClipboard(false)
        return
      }

      // 5-4. Ctrl+X: Cut Selected Files to Clipboard
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        copyToClipboard(true)
        return
      }

      // 5-5. Ctrl+V: Paste Files from Clipboard
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        pasteFromClipboard()
        return
      }

      // 6. Video Play/Pause (Default: Space)
      if (matchesBinding(e, hotkeys.playPause || 'Space')) {
        e.preventDefault()
        window.dispatchEvent(
          new CustomEvent('media-command', {
            detail: { action: 'playPause' }
          })
        )
        return
      }

      // 7. Video Mute Toggle (Default: M)
      if (matchesBinding(e, hotkeys.muteToggle || 'M')) {
        e.preventDefault()
        useSettingsStore.getState().toggleMute()
        return
      }

      // 8. Target Folders Move / Copy Custom Hotkeys (1~18 slots)
      // Row 1: Slots 1~9 (Move: 1~9, Copy: Ctrl+1~9)
      // Row 2: Slots 10~18 (Move: Shift+1~9, Copy: Ctrl+Shift+1~9)
      for (let slotId = 1; slotId <= 18; slotId++) {
        const defaultMove = slotId <= 9 ? String(slotId) : `Shift+${slotId - 9}`
        const defaultCopy = slotId <= 9 ? `Ctrl+${slotId}` : `Ctrl+Shift+${slotId - 9}`
        const moveBinding = hotkeys[`moveSlot${slotId}` as keyof typeof hotkeys] || defaultMove
        const copyBinding = hotkeys[`copySlot${slotId}` as keyof typeof hotkeys] || defaultCopy

        // Check Copy first
        if (matchesBinding(e, copyBinding)) {
          e.preventDefault()
          copySelectedFileToSlot(slotId)
          return
        }

        // Check Move
        if (matchesBinding(e, moveBinding)) {
          e.preventDefault()
          moveSelectedFileToSlot(slotId)
          return
        }
      }

      // 9. Video Seek hotkeys (Left / Right with modifiers)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const direction = e.key === 'ArrowRight' ? 1 : -1
        let seekSeconds: number | null = null

        // Ctrl + Alt + Left/Right -> Z sec
        if ((e.ctrlKey || e.metaKey) && e.altKey) {
          seekSeconds = (settings.seekSecCtrlAlt || 60) * direction
        }
        // Shift + Left/Right -> Y sec
        else if (e.shiftKey && !e.ctrlKey && !e.altKey) {
          seekSeconds = (settings.seekSecShift || 15) * direction
        }
        // Ctrl + Left/Right -> X sec
        else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
          seekSeconds = (settings.seekSecCtrl || 5) * direction
        }

        if (seekSeconds !== null) {
          e.preventDefault()
          window.dispatchEvent(
            new CustomEvent('media-command', {
              detail: { action: 'seek', seconds: seekSeconds }
            })
          )
          return
        }
      }

      // 10. Plain Arrow Keys for Folder Contents Navigation (2D Grid & Details)
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          navigateGrid('down')
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          navigateGrid('up')
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          navigateGrid('right')
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          navigateGrid('left')
          return
        }
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    selectedFile,
    navigateGrid,
    moveSelectedFileToSlot,
    copySelectedFileToSlot,
    selectAll,
    copyToClipboard,
    pasteFromClipboard,
    triggerUndo,
    triggerRedo,
    startRename,
    refreshCurrentTab,
    settings,
    isSettingsOpen,
    pendingConflict
  ])
}
