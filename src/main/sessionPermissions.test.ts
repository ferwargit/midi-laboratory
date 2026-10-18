import { describe, it, expect } from 'vitest'
import { isSessionPermissionAllowed } from './sessionPermissions'

describe('sessionPermissions - Política de allowlist de permisos de sesión', () => {
  it('aprueba el permiso midi (Web MIDI)', () => {
    expect(isSessionPermissionAllowed('midi')).toBe(true)
  })

  it('aprueba midiSysex requerido por el handshake de hardware Roland/Korg', () => {
    expect(isSessionPermissionAllowed('midiSysex')).toBe(true)
  })

  it('deniega permisos sensibles no relacionados', () => {
    const deniedPermissions = [
      'media',
      'geolocation',
      'notifications',
      'clipboard-read',
      'camera',
      'microphone'
    ]

    for (const permission of deniedPermissions) {
      expect(isSessionPermissionAllowed(permission)).toBe(false)
    }
  })

  it('deniega cualquier permiso desconocido (fail-closed)', () => {
    expect(isSessionPermissionAllowed('unknown-permission')).toBe(false)
    expect(isSessionPermissionAllowed('')).toBe(false)
  })
})
