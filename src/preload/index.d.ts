import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    customAPI: {
      checkLmStudioModels: () => Promise<string | null>
      chatLmStudio: (payload: { model: string; messages: unknown[] }) => Promise<{
        success: boolean
        content?: string
        model?: string
        error?: string
      }>
    }
  }
}
