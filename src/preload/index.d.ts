import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    customAPI: {
      checkLmStudioModels: (baseUrl?: string) => Promise<string | null>
      chatLmStudio: (payload: {
        model: string
        messages: unknown[]
        temperature?: number
        timeoutMs?: number
        baseUrl?: string
      }) => Promise<{
        success: boolean
        content?: string
        model?: string
        error?: string
      }>
    }
  }
}
