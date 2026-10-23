import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Settings, TargetFolderSlot, UndoAction, PresetConfig } from '../preload/types'

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

export interface AppConfig {
  settings: Settings
  targetSlots: TargetFolderSlot[]
  undoHistory: UndoAction[]
  redoHistory: UndoAction[]
  presets: PresetConfig[]
}

const DEFAULT_CONFIG: AppConfig = {
  settings: DEFAULT_SETTINGS,
  targetSlots: [],
  undoHistory: [],
  redoHistory: [],
  presets: []
}

export class ConfigStore {
  private configPath: string = ''
  private cache: AppConfig | null = null

  public setConfigPath(customPath: string): void {
    this.configPath = customPath
    this.cache = null
  }

  private getConfigPath(): string {
    if (!this.configPath) {
      let userData = ''
      try {
        if (app && typeof app.getPath === 'function') {
          userData = app.getPath('userData')
        }
      } catch {
        // App not available outside Electron
      }
      if (!userData) {
        userData = process.env.APPDATA || process.cwd()
      }
      this.configPath = path.join(userData, 'fast-media-organizer-config.json')
    }
    return this.configPath
  }

  public loadConfig(): AppConfig {
    if (this.cache) {
      return this.cache
    }

    const filePath = this.getConfigPath()
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        this.cache = {
          settings: {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings || {}),
            hotkeys: {
              ...DEFAULT_SETTINGS.hotkeys,
              ...(parsed.settings?.hotkeys || {})
            }
          },
          targetSlots: Array.isArray(parsed.targetSlots)
            ? parsed.targetSlots
            : this.normalizeSlots(parsed.targetSlots),
          undoHistory: Array.isArray(parsed.undoHistory) ? parsed.undoHistory.slice(0, 50) : [],
          redoHistory: Array.isArray(parsed.redoHistory) ? parsed.redoHistory.slice(0, 50) : [],
          presets: Array.isArray(parsed.presets) ? parsed.presets : []
        }
        return this.cache
      }
    } catch (err) {
      console.warn('[store] Failed to read config file, falling back to defaults:', err)
    }

    this.cache = { ...DEFAULT_CONFIG }
    this.saveConfig(this.cache)
    return this.cache
  }

  public saveConfig(config: AppConfig): boolean {
    this.cache = config
    const filePath = this.getConfigPath()
    const tmpPath = `${filePath}.tmp`

    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
      fs.renameSync(tmpPath, filePath)
      return true
    } catch (err) {
      console.error('[store] Failed to save config atomically:', err)
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath)
        }
      } catch {
        // ignore cleanup error
      }
      return false
    }
  }

  public getSettings(): Settings {
    return this.loadConfig().settings
  }

  public saveSettings(newSettings: Partial<Settings>): Settings {
    const current = this.loadConfig()
    const updated: Settings = {
      ...current.settings,
      ...newSettings,
      hotkeys: {
        ...current.settings.hotkeys,
        ...(newSettings.hotkeys || {})
      }
    }

    this.saveConfig({
      ...current,
      settings: updated
    })

    return updated
  }

  public getTargetSlots(): TargetFolderSlot[] {
    return this.loadConfig().targetSlots
  }

  public saveTargetSlots(
    slotsInput: TargetFolderSlot[] | Record<number, TargetFolderSlot | null>
  ): TargetFolderSlot[] {
    const current = this.loadConfig()
    const normalized = this.normalizeSlots(slotsInput)

    this.saveConfig({
      ...current,
      targetSlots: normalized
    })

    return normalized
  }

  public getUndoHistory(): UndoAction[] {
    return this.loadConfig().undoHistory
  }

  public getPresets(): PresetConfig[] {
    const config = this.loadConfig()
    return config.presets || []
  }

  public savePresets(presets: PresetConfig[]): PresetConfig[] {
    const config = this.loadConfig()
    const updated = {
      ...config,
      presets: presets || []
    }
    this.saveConfig(updated)
    return updated.presets
  }

  public pushUndoAction(action: UndoAction): void {
    const current = this.loadConfig()
    const updated = [action, ...current.undoHistory.filter((a) => a.id !== action.id)].slice(0, 50)
    this.saveConfig({
      ...current,
      undoHistory: updated,
      redoHistory: []
    })
  }

  public popUndoAction(): UndoAction | undefined {
    const current = this.loadConfig()
    if (current.undoHistory.length === 0) return undefined
    const [first, ...rest] = current.undoHistory
    this.saveConfig({
      ...current,
      undoHistory: rest
    })
    return first
  }

  public removeUndoAction(id: string): void {
    const current = this.loadConfig()
    this.saveConfig({
      ...current,
      undoHistory: current.undoHistory.filter((a) => a.id !== id)
    })
  }

  public getRedoHistory(): UndoAction[] {
    return this.loadConfig().redoHistory || []
  }

  public pushRedoAction(action: UndoAction): void {
    const current = this.loadConfig()
    const updated = [action, ...(current.redoHistory || []).filter((a) => a.id !== action.id)].slice(0, 50)
    this.saveConfig({
      ...current,
      redoHistory: updated
    })
  }

  public popRedoAction(): UndoAction | undefined {
    const current = this.loadConfig()
    if (!current.redoHistory || current.redoHistory.length === 0) return undefined
    const [first, ...rest] = current.redoHistory
    this.saveConfig({
      ...current,
      redoHistory: rest
    })
    return first
  }

  public clearRedoHistory(): void {
    const current = this.loadConfig()
    if (current.redoHistory && current.redoHistory.length > 0) {
      this.saveConfig({
        ...current,
        redoHistory: []
      })
    }
  }

  private normalizeSlots(
    slotsInput: TargetFolderSlot[] | Record<number, TargetFolderSlot | null> | undefined
  ): TargetFolderSlot[] {
    if (!slotsInput) return []
    if (Array.isArray(slotsInput)) {
      return slotsInput.filter((s) => s && s.id && s.path)
    }

    const result: TargetFolderSlot[] = []
    for (let id = 1; id <= 18; id++) {
      const slot = slotsInput[id]
      if (slot && slot.path) {
        result.push({
          id,
          path: slot.path,
          name: slot.name || path.basename(slot.path)
        })
      }
    }
    return result
  }
}

export const storeService = new ConfigStore()
