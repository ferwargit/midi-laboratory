import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { isSessionPermissionAllowed } from './sessionPermissions'
import { handleCheckModels, handleChatCompletion } from './lmStudioHandlers'
import { isOpenExternalUrlAllowed, isAllowedNavigation } from './windowNavigationGuard'

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
      preload: join(__dirname, '../preload/index.js'),
      // sandbox activo (hallazgo F1): el renderer corre como proceso sandboxeado
      // de Chromium sin acceso a Node. El canal único hacia LM Studio es IPC
      // (window.customAPI, compatible con sandbox); el fallback a fetch() que
      // motivaba desactivar el sandbox fue eliminado de lmStudioService.
      sandbox: true,
      contextIsolation: true,
      // DevTools según entorno (hallazgo F9): habilitadas en desarrollo,
      // deshabilitadas en el binario empaquetado.
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Prevención de navegaciones in-frame no autorizadas (hallazgo F8): solo se
  // permite navegar al origen local de la aplicación (dev server en desarrollo,
  // file:// en producción); cualquier otro origen se cancela con log auditable.
  const allowedOrigin = is.dev
    ? new URL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173').origin
    : 'file://'
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, allowedOrigin)) {
      event.preventDefault()
      console.warn(`[Navegación] Cancelada: "${url}" (origen permitido: ${allowedOrigin})`)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Validación estricta de esquema (hallazgo F7): solo http/https bien
    // formados llegan a shell.openExternal; el resto se deniega sin abrir.
    if (isOpenExternalUrlAllowed(details.url)) {
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
