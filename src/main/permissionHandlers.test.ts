import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import './index'

/**
 * Superficie mockeada de Electron para el test de cableado (design D5.2).
 * El mock se limita a los símbolos que src/main/index.ts importa al cargar;
 * si la importación cambia, el test falla por import faltante, no en silencio.
 *
 * `callLog` registra el orden de eventos relevantes (registro de handlers vs.
 * creación de ventana) porque un spy de vi.fn() no es constructable con `new`.
 */
const { callLog, sessionMocks, MockBrowserWindow } = vi.hoisted(() => {
  const callLog: string[] = []
  return {
    callLog,
    sessionMocks: {
      setPermissionRequestHandler: vi.fn<(handler: unknown) => void>(() => {
        callLog.push('register-request-handler')
      }),
      setPermissionCheckHandler: vi.fn<(handler: unknown) => void>(() => {
        callLog.push('register-check-handler')
      })
    },
    MockBrowserWindow: class {
      on = vi.fn()
      webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() }
      loadFile = vi.fn()
      loadURL = vi.fn()
      constructor() {
        callLog.push('create-window')
      }
    }
  }
})

vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn()
  },
  shell: { openExternal: vi.fn() },
  BrowserWindow: MockBrowserWindow,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  session: { defaultSession: sessionMocks }
}))

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false }
}))

type PermissionRequestHandler = (
  webContents: unknown,
  permission: string,
  callback: (granted: boolean) => void,
  details: { requestingUrl?: string; isMainFrame?: boolean } | undefined
) => void

type PermissionCheckHandler = (
  webContents: unknown,
  permission: string,
  requestingOrigin: string,
  details: unknown
) => boolean

const DETAILS_SAMPLE = { requestingUrl: 'http://localhost:5173', isMainFrame: true }

describe('permissionHandlers - Cableado de la política de permisos en el proceso Main', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('registra ambos handlers en session.defaultSession antes de crear la ventana', async () => {
    await vi.waitFor(() => {
      expect(sessionMocks.setPermissionRequestHandler).toHaveBeenCalledTimes(1)
      expect(sessionMocks.setPermissionCheckHandler).toHaveBeenCalledTimes(1)
    })

    // La única vía de registro en index.ts es el callback de app.whenReady();
    // la política debe quedar en vigor antes de la primera BrowserWindow (design D1).
    expect(callLog).toContain('register-request-handler')
    expect(callLog).toContain('register-check-handler')
    expect(callLog).toContain('create-window')
    expect(callLog.indexOf('register-request-handler')).toBeLessThan(
      callLog.indexOf('create-window')
    )
    expect(callLog.indexOf('register-check-handler')).toBeLessThan(callLog.indexOf('create-window'))
  })

  it('el handler de solicitudes aprueba midi y midiSysex y deniega media', async () => {
    await vi.waitFor(() => expect(sessionMocks.setPermissionRequestHandler).toHaveBeenCalled())

    const requestHandler = sessionMocks.setPermissionRequestHandler.mock
      .calls[0][0] as PermissionRequestHandler

    const grantMidi = vi.fn()
    requestHandler({}, 'midi', grantMidi, DETAILS_SAMPLE)
    expect(grantMidi).toHaveBeenCalledWith(true)

    const grantSysex = vi.fn()
    requestHandler({}, 'midiSysex', grantSysex, DETAILS_SAMPLE)
    expect(grantSysex).toHaveBeenCalledWith(true)

    const denyMedia = vi.fn()
    requestHandler({}, 'media', denyMedia, DETAILS_SAMPLE)
    expect(denyMedia).toHaveBeenCalledWith(false)
  })

  it('el handler de comprobaciones síncronas aplica la misma política', async () => {
    await vi.waitFor(() => expect(sessionMocks.setPermissionCheckHandler).toHaveBeenCalled())

    const checkHandler = sessionMocks.setPermissionCheckHandler.mock
      .calls[0][0] as PermissionCheckHandler

    expect(checkHandler({}, 'midi', 'http://localhost:5173', {})).toBe(true)
    expect(checkHandler({}, 'midiSysex', 'http://localhost:5173', {})).toBe(true)
    expect(checkHandler({}, 'geolocation', 'http://localhost:5173', {})).toBe(false)
  })

  it('registra en consola cada denegación con el nombre del permiso y el contexto del solicitante', async () => {
    await vi.waitFor(() => expect(sessionMocks.setPermissionRequestHandler).toHaveBeenCalled())

    const requestHandler = sessionMocks.setPermissionRequestHandler.mock
      .calls[0][0] as PermissionRequestHandler

    requestHandler({}, 'media', vi.fn(), DETAILS_SAMPLE)

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('media'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('origen: http://localhost:5173'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('marco principal: true'))
  })
})
