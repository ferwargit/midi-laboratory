import { contextBridge, ipcRenderer } from 'electron'

const customAPI = {
  checkLmStudioModels: (baseUrl?: string): Promise<string | null> =>
    ipcRenderer.invoke('lm-studio:check-models', baseUrl),
  chatLmStudio: (payload: {
    model: string
    messages: unknown[]
    temperature?: number
    timeoutMs?: number
    baseUrl?: string
  }): Promise<{
    success: boolean
    content?: string
    model?: string
    error?: string
  }> => ipcRenderer.invoke('lm-studio:chat-completion', payload)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('customAPI', customAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.customAPI = customAPI
}
