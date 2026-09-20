export type AppMode = 'single_note' | 'intervals' | 'sequences' | 'repertoire' | 'analytics'

export type ShortcutAction = 'advance' | 'repeat' | null

export interface ShortcutContext {
  appMode: AppMode
  singleNoteWaiting: boolean
  singleNoteActive: boolean
  intervalWaiting: boolean
  intervalActive: boolean
  sequenceWaiting: boolean
  sequenceActive: boolean
  repertoireWaiting: boolean
  repertoireActive: boolean
}

export interface ShortcutDecision {
  action: ShortcutAction
  shouldPreventDefault: boolean
}

const NO_DECISION: ShortcutDecision = { action: null, shouldPreventDefault: false }

const ADVANCE_FLAGS: Record<Exclude<AppMode, 'analytics'>, keyof ShortcutContext> = {
  single_note: 'singleNoteWaiting',
  intervals: 'intervalWaiting',
  sequences: 'sequenceWaiting',
  repertoire: 'repertoireWaiting'
}

const REPEAT_FLAGS: Record<Exclude<AppMode, 'analytics'>, keyof ShortcutContext> = {
  single_note: 'singleNoteActive',
  intervals: 'intervalActive',
  sequences: 'sequenceActive',
  repertoire: 'repertoireActive'
}

function isAdvanceWaiting(ctx: ShortcutContext): boolean {
  const flag = ADVANCE_FLAGS[ctx.appMode as Exclude<AppMode, 'analytics'>]
  return flag !== undefined && ctx[flag] === true
}

function isRepeatActive(ctx: ShortcutContext): boolean {
  const flag = REPEAT_FLAGS[ctx.appMode as Exclude<AppMode, 'analytics'>]
  return flag !== undefined && ctx[flag] === true
}

/**
 * Decisión pura (sin efectos secundarios) para el handler global de keydown.
 *
 * - Space: solo previene el comportamiento nativo cuando la modalidad activa
 *   está esperando avance manual. En cualquier otro caso (incluido
 *   `appMode === 'analytics'`) se conserva el scroll nativo. (F5-04)
 *
 * - R/r: repite solo si NO hay modificadores de navegador recargadores
 *   (Ctrl, Meta, Alt). Shift queda permitido. (F5-15)
 *
 * Los guards de `isResetModalOpen` e `isTyping` se mantienen en `App.tsx`
 * porque dependen del DOM del evento, no del contexto de atajos.
 */
export function resolveShortcutDecision(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  ctx: ShortcutContext
): ShortcutDecision {
  if (event.code === 'Space') {
    if (isAdvanceWaiting(ctx)) {
      return { action: 'advance', shouldPreventDefault: true }
    }
    return NO_DECISION
  }

  const isRKey = event.key === 'r' || event.key === 'R'
  if (isRKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (isRepeatActive(ctx)) {
      return { action: 'repeat', shouldPreventDefault: false }
    }
  }

  return NO_DECISION
}
