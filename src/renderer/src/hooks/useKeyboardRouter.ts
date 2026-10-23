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
  if (key === ' ') {
    key = 'Space'
  } else if (/^Digit([0-9])$/.test(e.code)) {
    key = e.code.replace('Digit', '')
  } else if (/^Numpad([0-9])$/.test(e.code)) {
    key = e.code.replace('Numpad', '')
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
    nextFile,
    prevFile,
    moveSelectedFileToSlot,
    copySelectedFileToSlot,
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

  const { triggerUndo } = useUndoStore()
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

      // 8. Target Folders Move / Copy Custom Hotkeys (1~9 slots)
      for (let slotId = 1; slotId <= 9; slotId++) {
        const moveBinding = hotkeys[`moveSlot${slotId}` as keyof typeof hotkeys] || String(slotId)
        const copyBinding =
          hotkeys[`copySlot${slotId}` as keyof typeof hotkeys] || `Ctrl+${slotId}`

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

      // 10. Plain Arrow Keys for Folder Contents Navigation (Section 3)
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault()
          nextFile()
          return
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault()
          prevFile()
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
    nextFile,
    prevFile,
    moveSelectedFileToSlot,
    copySelectedFileToSlot,
    triggerUndo,
    startRename,
    refreshCurrentTab,
    settings,
    isSettingsOpen,
    pendingConflict
  ])
}
