import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const LM_STUDIO_DEFAULT_HOST = 'http://127.0.0.1:1234'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), // sandbox: false es intencional. Con sandbox: true, window.customAPI
      // (expuesto vía contextBridge) deja de estar disponible en el renderer,
      // forzando el fallback a fetch() directo en lmStudioService, que a su vez
      // choca con el Content-Security-Policy de index.html. Para una app de
      // uso 100% personal y local, el costo funcional de sandbox no compensa
      // la ganancia de seguridad. contextIsolation: true ya aísla el contexto
      // del renderer del de Node, que es la mitigación relevante acá.
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https:') || details.url.startsWith('http:')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// HANDLERS IPC ROBUSTOS CON ABORTCONTROLLER Y TIMEOUT
ipcMain.handle('lm-studio:check-models', async (_, baseUrl?: string) => {
  const host = baseUrl || LM_STUDIO_DEFAULT_HOST
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch(`${host}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const data = (await res.json()) as { data?: Array<{ id: string }> }
    if (data.data && data.data.length > 0) {
      return data.data[0].id as string
    }
    return null
  } catch {
    clearTimeout(timer)
    return null
  }
})

ipcMain.handle(
  'lm-studio:chat-completion',
  async (
    _,
    payload: {
      model: string
      messages: unknown[]
      temperature?: number
      timeoutMs?: number
      baseUrl?: string
    }
  ) => {
    const host = payload.baseUrl || LM_STUDIO_DEFAULT_HOST
    const timeoutMs = payload.timeoutMs || 900000 // 15 minutos por defecto para deep reasoning en GPU
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${host}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: payload.model,
          messages: payload.messages,
          temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3
        }),
        signal: controller.signal
      })
      clearTimeout(timer)

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: errorText }
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
        model?: string
      }
      const message = data.choices?.[0]?.message
      const content = message?.content || message?.reasoning_content || ''

      return { success: true, content, model: data.model || payload.model }
    } catch (err: unknown) {
      clearTimeout(timer)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
)

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
