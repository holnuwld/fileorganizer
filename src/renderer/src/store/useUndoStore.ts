import { create } from 'zustand'
import { UndoAction } from '../types'
import { useExplorerStore } from './useExplorerStore'

interface UndoState {
  undoStack: UndoAction[]
  isUndoing: boolean
  lastUndoneAction: UndoAction | null
  pushUndoAction: (action: UndoAction) => void
  popUndoAction: () => UndoAction | undefined
  triggerUndo: () => Promise<boolean>
  loadHistory: () => Promise<void>
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  isUndoing: false,
  lastUndoneAction: null,

  pushUndoAction: (action: UndoAction) => {
    set((state) => ({
      undoStack: [action, ...state.undoStack].slice(0, 50)
    }))
  },

  popUndoAction: () => {
    const stack = get().undoStack
    if (stack.length === 0) return undefined
    const [first, ...rest] = stack
    set({ undoStack: rest, lastUndoneAction: first })
    return first
  },

  loadHistory: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getUndoHistory) {
        const history = await window.electronAPI.getUndoHistory()
        if (history) {
          set({ undoStack: history })
        }
      }
    } catch (e) {
      console.warn('Failed to load undo history:', e)
    }
  },

  triggerUndo: async () => {
    if (get().isUndoing) return false
    const stack = get().undoStack
    if (stack.length === 0) {
      console.log('No actions to undo')
      return false
    }

    set({ isUndoing: true })
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.undoAction) {
        const res = await window.electronAPI.undoAction()
        if (res.success && res.undoneAction) {
          set((state) => ({
            undoStack: state.undoStack.filter((a) => a.id !== res.undoneAction?.id),
            lastUndoneAction: res.undoneAction
          }))
          // Refresh current folder view
          await useExplorerStore.getState().refreshCurrentTab()
          return true
        } else {
          console.warn('Undo failed on backend:', res.error)
          return false
        }
      } else {
        // Fallback pop
        const action = get().popUndoAction()
        if (action) {
          await useExplorerStore.getState().refreshCurrentTab()
          return true
        }
        return false
      }
    } catch (e) {
      console.error('Error triggering undo:', e)
      return false
    } finally {
      set({ isUndoing: false })
    }
  }
}))
