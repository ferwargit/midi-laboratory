declare global {
  interface Window {
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

// El archivo debe permanecer como módulo externo para que `declare global`
// siga aplicando la augmentación de Window al proyecto del renderer.
export {}
