/**
 * Política de permisos de sesión de Electron (capacidad 08-electron-session-security).
 *
 * Allowlist canónico: los únicos permisos de Web API autorizados son 'midi' y
 * 'midiSysex'. SysEx se autoriza porque el handshake y la enumeración inicial
 * de interfaces MIDI físicas (Roland FP-8 / UM-ONE, teclados Korg) en
 * Chromium/Electron lo requieren: al denegarlo, Chromium aborta la
 * inicialización de la interfaz y la lista de puertos queda vacía
 * (evidencia de runtime de la verificación 3.3 con hardware real conectado).
 * Todo permiso no listado se deniega (fail-closed): 'media', 'geolocation',
 * 'notifications', 'camera', 'microphone', etc.
 */
export const ALLOWED_SESSION_PERMISSIONS = new Set<string>(['midi', 'midiSysex'])

export function isSessionPermissionAllowed(permission: string): boolean {
  return ALLOWED_SESSION_PERMISSIONS.has(permission)
}
