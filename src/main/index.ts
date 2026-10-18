import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { isSessionPermissionAllowed } from './sessionPermissions'
import { handleCheckModels, handleChatCompletion } from './lmStudioHandlers'

/**
 * Política de permisos de sesión (capacidad 08-electron-session-security,
 * hallazgo F4 de la auditoría V7). Electron aprueba automáticamente cualquier
 * solicitud de permiso cuando no hay handler configurado; este cableado aplica
 * el allowlist canónico de sessionPermissions.ts en ambos puntos de entrada:
 * solicitudes asíncronas (setPermissionRequestHandler) y comprobaciones
 * síncronas (setPermissionCheckHandler). Debe invocarse antes de crear la
 * primera ventana para que ninguna solicitud pueda llegar sin política.
 */
function registerSessionPermissionHandlers(): void {
  const deny = (permission: string, origin?: string, isMainFrame?: boolean): void => {
    const context: string[] = []
    if (origin) context.push(`origen: ${origin}`)
    if (isMainFrame !== undefined) context.push(`marco principal: ${isMainFrame}`)
    const suffix = context.length > 0 ? ` (${context.join(', ')})` : ''
    console.warn(`[Permisos] Denegado: '${permission}'${suffix}`)
  }

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      if (isSessionPermissionAllowed(permission)) {
        callback(true)
        return
      }
      deny(permission, details?.requestingUrl, details?.isMainFrame)
      callback(false)
    }
  )

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) => {
      if (isSessionPermissionAllowed(permission)) return true
      deny(permission, requestingOrigin, details?.isMainFrame)
      return false
    }
  )
}

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
// La lógica vive en lmStudioHandlers.ts (testeable sin Electron); aquí solo se
// registran sobre ipcMain. Toda baseUrl del Renderer se valida con el
// allowlist de host local (lmStudioHostValidator.ts) antes de cualquier fetch.
ipcMain.handle('lm-studio:check-models', (_, baseUrl?: string) => handleCheckModels(baseUrl))

ipcMain.handle('lm-studio:chat-completion', (_, payload) => handleChatCompletion(payload))

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  registerSessionPermissionHandlers()

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
