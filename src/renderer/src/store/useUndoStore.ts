import { create } from 'zustand'
import { UndoAction } from '../types'
import { useExplorerStore } from './useExplorerStore'

interface UndoState {
  undoStack: UndoAction[]
  redoStack: UndoAction[]
  isUndoing: boolean
  isRedoing: boolean
  lastUndoneAction: UndoAction | null
  lastRedoneAction: UndoAction | null
  pushUndoAction: (action: UndoAction) => void
  popUndoAction: () => UndoAction | undefined
  triggerUndo: () => Promise<boolean>
  triggerRedo: () => Promise<boolean>
  loadHistory: () => Promise<void>
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isUndoing: false,
  isRedoing: false,
  lastUndoneAction: null,
  lastRedoneAction: null,

  pushUndoAction: (action: UndoAction) => {
    set((state) => ({
      undoStack: [action, ...state.undoStack].slice(0, 50),
      redoStack: []
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
      if (typeof window !== 'undefined' && window.electronAPI?.getRedoHistory) {
        const redoHistory = await window.electronAPI.getRedoHistory()
        if (redoHistory) {
          set({ redoStack: redoHistory })
        }
      }
    } catch (e) {
      console.warn('Failed to load undo/redo history:', e)
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
            redoStack: [res.undoneAction!, ...state.redoStack].slice(0, 50),
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
          set((state) => ({
            redoStack: [action, ...state.redoStack].slice(0, 50)
          }))
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
  },

  triggerRedo: async () => {
    if (get().isRedoing) return false
    const stack = get().redoStack
    if (stack.length === 0) {
      console.log('No actions to redo')
      return false
    }

    set({ isRedoing: true })
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.redoAction) {
        const res = await window.electronAPI.redoAction()
        if (res.success && res.redoneAction) {
          set((state) => ({
            redoStack: state.redoStack.filter((a) => a.id !== res.redoneAction?.id),
            undoStack: [res.redoneAction!, ...state.undoStack].slice(0, 50),
            lastRedoneAction: res.redoneAction
          }))
          // Refresh current folder view
          await useExplorerStore.getState().refreshCurrentTab()
          return true
        } else {
          console.warn('Redo failed on backend:', res.error)
          return false
        }
      } else {
        const [first, ...rest] = stack
        set((state) => ({
          redoStack: rest,
          undoStack: [first, ...state.undoStack].slice(0, 50),
          lastRedoneAction: first
        }))
        await useExplorerStore.getState().refreshCurrentTab()
        return true
      }
    } catch (e) {
      console.error('Error triggering redo:', e)
      return false
    } finally {
      set({ isRedoing: false })
    }
  }
}))
