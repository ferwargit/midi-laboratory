import { describe, it, expect } from 'vitest'
import { resolveShortcutDecision, ShortcutContext, AppMode } from './shortcutDecision'

// Fabrica un contexto base inactivo (sin sesión, sin avance en espera).
function idleContext(overrides: Partial<ShortcutContext> = {}): ShortcutContext {
  return {
    appMode: 'single_note',
    singleNoteWaiting: false,
    singleNoteActive: false,
    intervalWaiting: false,
    intervalActive: false,
    sequenceWaiting: false,
    sequenceActive: false,
    repertoireWaiting: false,
    repertoireActive: false,
    ...overrides
  }
}

function spaceEvent(modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    code: 'Space',
    key: ' ',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers
  } as KeyboardEvent
}

function rEvent(modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    code: 'KeyR',
    key: 'r',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers
  } as KeyboardEvent
}

describe('resolveShortcutDecision - Atajo Space (F5-04)', () => {
  it('NO previene el comportamiento nativo cuando ninguna modalidad está esperando avance manual', () => {
    const decision = resolveShortcutDecision(spaceEvent(), idleContext())

    expect(decision.shouldPreventDefault).toBe(false)
    expect(decision.action).toBe(null)
  })

  it('NO previene el comportamiento nativo en modo analytics (no hay sesión activa)', () => {
    const decision = resolveShortcutDecision(spaceEvent(), idleContext({ appMode: 'analytics' }))

    expect(decision.shouldPreventDefault).toBe(false)
    expect(decision.action).toBe(null)
  })

  it('NO previene cuando la modalidad activa está en sesión pero no espera avance', () => {
    const decision = resolveShortcutDecision(
      spaceEvent(),
      idleContext({ appMode: 'intervals', intervalActive: true })
    )

    expect(decision.shouldPreventDefault).toBe(false)
    expect(decision.action).toBe(null)
  })

  it('NO previene cuando otra modalidad distinta a la activa está esperando avance', () => {
    const decision = resolveShortcutDecision(
      spaceEvent(),
      idleContext({ appMode: 'single_note', sequenceWaiting: true })
    )

    expect(decision.shouldPreventDefault).toBe(false)
    expect(decision.action).toBe(null)
  })

  const advanceCases: Array<{ mode: AppMode; flag: keyof ShortcutContext; label: string }> = [
    { mode: 'single_note', flag: 'singleNoteWaiting', label: 'single_note' },
    { mode: 'intervals', flag: 'intervalWaiting', label: 'intervals' },
    { mode: 'sequences', flag: 'sequenceWaiting', label: 'sequences' },
    { mode: 'repertoire', flag: 'repertoireWaiting', label: 'repertoire' }
  ]

  advanceCases.forEach(({ mode, flag, label }) => {
    it(`PREVIENE el nativo y avanza cuando ${label} está esperando avance manual`, () => {
      const decision = resolveShortcutDecision(
        spaceEvent(),
        idleContext({ appMode: mode, [flag]: true } as Partial<ShortcutContext>)
      )

      expect(decision.shouldPreventDefault).toBe(true)
      expect(decision.action).toBe('advance')
    })
  })
})

describe('resolveShortcutDecision - Atajo R (F5-15)', () => {
  const repeatCases: Array<{ mode: AppMode; flag: keyof ShortcutContext; label: string }> = [
    { mode: 'single_note', flag: 'singleNoteActive', label: 'single_note' },
    { mode: 'intervals', flag: 'intervalActive', label: 'intervals' },
    { mode: 'sequences', flag: 'sequenceActive', label: 'sequences' },
    { mode: 'repertoire', flag: 'repertoireActive', label: 'repertoire' }
  ]

  repeatCases.forEach(({ mode, flag, label }) => {
    it(`repite con R limpio cuando ${label} tiene sesión activa`, () => {
      const decision = resolveShortcutDecision(
        rEvent(),
        idleContext({ appMode: mode, [flag]: true } as Partial<ShortcutContext>)
      )

      expect(decision.action).toBe('repeat')
      expect(decision.shouldPreventDefault).toBe(false)
    })
  })

  it('NO repite con Ctrl+R (recarga del navegador)', () => {
    const decision = resolveShortcutDecision(
      rEvent({ ctrlKey: true }),
      idleContext({ appMode: 'single_note', singleNoteActive: true })
    )

    expect(decision.action).toBe(null)
  })

  it('NO repite con Meta+R (Cmd+R en macOS)', () => {
    const decision = resolveShortcutDecision(
      rEvent({ metaKey: true }),
      idleContext({ appMode: 'single_note', singleNoteActive: true })
    )

    expect(decision.action).toBe(null)
  })

  it('NO repite con Alt+R', () => {
    const decision = resolveShortcutDecision(
      rEvent({ altKey: true }),
      idleContext({ appMode: 'single_note', singleNoteActive: true })
    )

    expect(decision.action).toBe(null)
  })

  it('SÍ repite con Shift+R (modificador no filtrado)', () => {
    const decision = resolveShortcutDecision(
      rEvent({ shiftKey: true, key: 'R' }),
      idleContext({ appMode: 'single_note', singleNoteActive: true })
    )

    expect(decision.action).toBe('repeat')
  })

  it('NO repite cuando no hay sesión activa', () => {
    const decision = resolveShortcutDecision(rEvent(), idleContext())

    expect(decision.action).toBe(null)
  })

  it('NO repite en modo analytics', () => {
    const decision = resolveShortcutDecision(
      rEvent(),
      idleContext({ appMode: 'analytics', singleNoteActive: true })
    )

    expect(decision.action).toBe(null)
  })
})

describe('resolveShortcutDecision - Teclas no mapeadas', () => {
  it('ignora cualquier otra tecla', () => {
    const decision = resolveShortcutDecision(
      { code: 'Enter', key: 'Enter' } as KeyboardEvent,
      idleContext({ appMode: 'single_note', singleNoteWaiting: true, singleNoteActive: true })
    )

    expect(decision.action).toBe(null)
    expect(decision.shouldPreventDefault).toBe(false)
  })
})
