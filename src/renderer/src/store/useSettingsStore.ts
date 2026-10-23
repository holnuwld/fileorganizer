import { create } from 'zustand'
import { Settings } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoPlayVideo: true,
  videoMuted: false,
  videoVolume: 0.8,
  seekSecCtrl: 5,
  seekSecShift: 15,
  seekSecCtrlAlt: 60,
  conflictPolicy: 'ask',
  hotkeys: {
    moveSlot1: '1',
    moveSlot2: '2',
    moveSlot3: '3',
    moveSlot4: '4',
    moveSlot5: '5',
    moveSlot6: '6',
    moveSlot7: '7',
    moveSlot8: '8',
    moveSlot9: '9',
    moveSlot10: 'Shift+1',
    moveSlot11: 'Shift+2',
    moveSlot12: 'Shift+3',
    moveSlot13: 'Shift+4',
    moveSlot14: 'Shift+5',
    moveSlot15: 'Shift+6',
    moveSlot16: 'Shift+7',
    moveSlot17: 'Shift+8',
    moveSlot18: 'Shift+9',
    copySlot1: 'Ctrl+1',
    copySlot2: 'Ctrl+2',
    copySlot3: 'Ctrl+3',
    copySlot4: 'Ctrl+4',
    copySlot5: 'Ctrl+5',
    copySlot6: 'Ctrl+6',
    copySlot7: 'Ctrl+7',
    copySlot8: 'Ctrl+8',
    copySlot9: 'Ctrl+9',
    copySlot10: 'Ctrl+Shift+1',
    copySlot11: 'Ctrl+Shift+2',
    copySlot12: 'Ctrl+Shift+3',
    copySlot13: 'Ctrl+Shift+4',
    copySlot14: 'Ctrl+Shift+5',
    copySlot15: 'Ctrl+Shift+6',
    copySlot16: 'Ctrl+Shift+7',
    copySlot17: 'Ctrl+Shift+8',
    copySlot18: 'Ctrl+Shift+9',
    playPause: 'Space',
    muteToggle: 'M',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    rename: 'F2',
    refresh: 'F5',
    assignNextSlot: 'Ctrl+ArrowUp'
  }
}

interface SettingsState {
  settings: Settings
  isLoading: boolean
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  loadSettings: () => Promise<void>
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  setVideoVolume: (volume: number) => Promise<void>
  toggleMute: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  isSettingsOpen: false,

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  loadSettings: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getSettings) {
        set({ isLoading: true })
        const saved = await window.electronAPI.getSettings()
        if (saved) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...saved,
            hotkeys: {
              ...DEFAULT_SETTINGS.hotkeys,
              ...(saved.hotkeys || {})
            }
          }
          set({ settings: merged })

          if (merged.theme === 'light') {
            document.documentElement.classList.add('light')
          } else {
            document.documentElement.classList.remove('light')
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load settings via electronAPI, using defaults', e)
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (newSettings: Partial<Settings>) => {
    const updated = {
      ...get().settings,
      ...newSettings,
      hotkeys: {
        ...get().settings.hotkeys,
        ...(newSettings.hotkeys || {})
      }
    }
    set({ settings: updated })

    if (updated.theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveSettings) {
        await window.electronAPI.saveSettings(updated)
      } else {
        localStorage.setItem('fast_media_settings', JSON.stringify(updated))
      }
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  },

  setTheme: async (theme: 'dark' | 'light') => {
    await get().updateSettings({ theme })
  },

  setVideoVolume: async (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    const updated = {
      ...get().settings,
      videoVolume: clamped,
      videoMuted: clamped === 0 ? true : get().settings.videoMuted
    }
    set({ settings: updated })
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveSettings) {
        await window.electronAPI.saveSettings(updated)
      }
    } catch (e) {
      console.error('Failed to persist volume change:', e)
    }
  },

  toggleMute: async () => {
    const updated = {
      ...get().settings,
      videoMuted: !get().settings.videoMuted
    }
    set({ settings: updated })
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveSettings) {
        await window.electronAPI.saveSettings(updated)
      }
    } catch (e) {
      console.error('Failed to persist mute change:', e)
    }
  }
}))
