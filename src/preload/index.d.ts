import { ElectronAPI } from '@electron-toolkit/preload'
import { CustomElectronAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: CustomElectronAPI
    api: CustomElectronAPI
  }
}

export {}
