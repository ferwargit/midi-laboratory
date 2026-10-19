import { DbAnswerRecord, DbSessionRecord, SessionTargetMode } from '../database/types'
import { EXERCISE_PRESETS, MusicPreset } from '../music/presets'
import { INTERVAL_PRESETS } from '../music/intervals'
import { SEQUENCE_PRESETS } from '../music/sequences'

/**
 * SSOT de modalidad y pool de sesión (remediación F21, Auditoría V9).
 *
 * Módulo único dueño de:
 * 1. La resolución de la modalidad pedagógica (`resolveSessionMode`), basada
 *    primariamente en el campo canónico `targetMode` del registro de sesión.
 * 2. La resolución del tamaño nominal del pool de notas
 *    (`resolveNominalPoolSize`), vinculada directamente a los presets
 *    canónicos del sistema (`EXERCISE_PRESETS`, `INTERVAL_PRESETS`,
 *    `SEQUENCE_PRESETS`).
 * 3. El matching de preset para los filtros de analítica
 *    (`matchesSessionPreset`).
 *
 * Las heurísticas de cadenas sobre `presetName` viven EXCLUSIVAMENTE aquí y
 * solo como fallback defensivo para registros históricos heredados (sin
 * `targetMode` o con nomenclatura previa a los presets canónicos). Ningún
 * consumidor de analítica debe contener su propia copia (F-06/F-14/F-21).
 */

export type SessionMode = SessionTargetMode

/** Separador que los entrenadores interponen entre el contenido y el formato. */
const CONTENT_SEPARATOR = '•'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Segmento de contenido de un `presetName`: la porción previa al separador
 * `•` (convención de composición de los entrenadores y de agrupación de
 * `computeLongitudinalComparisons`).
 */
function contentSegment(presetName: string): string {
  return (presetName || '').split(CONTENT_SEPARATOR)[0].trim()
}

function findNotePreset(presetId: string): MusicPreset | undefined {
  return EXERCISE_PRESETS.find((p) => p.id === presetId)
}

/**
 * Matcher legacy de presets de notas sueltas por alias de nomenclatura
 * histórica. Usa extracción numérica exacta del nivel (`nivel\s*(\d+)`) para
 * evitar la colisión F-06/F-14 ("nivel 10" contiene "nivel 1").
 */
function matchLegacyNotePreset(name: string): MusicPreset | undefined {
  const levelMatch = name.match(/nivel\s*(\d+)/i)
  const level = levelMatch ? parseInt(levelMatch[1], 10) : NaN
  if (level === 1) return findNotePreset('level_1_c_d_e')
  if (level === 2) return findNotePreset('level_2_c_to_g')
  if (level === 3 || name.includes('octava diatónica'))
    return findNotePreset('level_3_octave_diatonic')
  if (level === 4 || name.includes('cromático')) return findNotePreset('level_4_octave_chromatic')
  if (name.includes('pentatónica')) return findNotePreset('pentatonic_c_major')
  return undefined
}

/**
 * Resuelve la modalidad pedagógica de una sesión con prioridad única:
 * 1. `targetMode` canónico si está presente.
 * 2. Heurísticas históricas en el orden repertorio → intervalos → secuencias
 *    → notas sueltas (solo registros heredados sin `targetMode`).
 * 3. `null` cuando ninguna señal clasifica la sesión (los consumidores
 *    aplican su default `single_note`; los predicados de modalidad no la
 *    aceptan por ningún modo).
 */
export function resolveSessionMode(session: DbSessionRecord): SessionMode | null {
  if (session.targetMode) return session.targetMode

  const name = (session.presetName || '').toLowerCase()
  const strategyId = session.strategyId || ''
  const instrumentId = session.instrumentId || ''

  if (
    strategyId.includes('repertoire') ||
    instrumentId.includes('repertoire') ||
    name.includes('partitura') ||
    name.includes('repertorio')
  ) {
    return 'repertoire'
  }

  if (
    strategyId.includes('intervals') ||
    instrumentId === 'piano_intervals' ||
    name.includes('intervalo')
  ) {
    return 'intervals'
  }

  if (
    strategyId.includes('sequences') ||
    instrumentId === 'piano_sequences' ||
    name.includes('secuencia')
  ) {
    return 'sequences'
  }

  if (
    strategyId === 'random' ||
    strategyId === 'adaptive_v1' ||
    strategyId === 'spaced_repetition' ||
    name.includes('nota') ||
    name.includes('maestría') ||
    name.includes('tiempo') ||
    name.includes('cronometrado')
  ) {
    return 'single_note'
  }

  return null
}

/**
 * Resuelve el tamaño nominal del pool de notas activas de una sesión.
 *
 * Cadena de prioridad:
 * 1. **Canónico**: el segmento de contenido del `presetName` (porción previa
 *    a `•`) coincidido contra los nombres de los tres catálogos canónicos →
 *    `notes.length` / `intervalSemitones.length` / `candidateNotes.length`.
 * 2. **Heurístico histórico** (fallback defensivo para registros heredados):
 *    conteo entre paréntesis ("Intervalos (6 activos)"), presets de
 *    intervalos 1.x, alias de niveles de notas, pentatónica y notas
 *    personalizadas. `Math.max(2, …)` en toda rama derivada garantiza
 *    `poolSize >= 2` (y `chanceBaseline <= 0.5`) aguas abajo.
 * 3. **Empírico**: conteo de notas únicas esperadas en las respuestas de la
 *    sesión, con piso 2.
 */
export function resolveNominalPoolSize(
  session: DbSessionRecord,
  answers?: DbAnswerRecord[]
): number {
  const name = (session.presetName || '').toLowerCase()
  const content = normalize(contentSegment(session.presetName || ''))

  // 1. Coincidencia canónica contra los tres catálogos de presets.
  if (content) {
    const notePreset = EXERCISE_PRESETS.find((p) => normalize(p.name) === content)
    if (notePreset) return notePreset.notes.length

    const intervalPreset = INTERVAL_PRESETS.find((p) => normalize(p.name) === content)
    if (intervalPreset) return intervalPreset.intervalSemitones.length

    const sequencePreset = SEQUENCE_PRESETS.find((p) => normalize(p.name) === content)
    if (sequencePreset) return sequencePreset.candidateNotes.length
  }

  // 2. Heurísticas históricas (solo registros heredados).
  // 2a. Conteo numérico entre paréntesis: "Intervalos (6 activos)" → 6,
  //     "Secuencias (3 notas)" → 3, "Notas Personalizadas (4)" → 4.
  const poolMatch = name.match(/\((\d+)\s*(?:activos|notas|tonos|intervalos)?\)/i)
  if (poolMatch) {
    return Math.max(2, parseInt(poolMatch[1], 10))
  }

  // 2b. Presets de intervalos nivel 1.x (DEBEN ir ANTES del matcher de
  //     niveles genéricos para evitar la colisión 'nivel 1.1' → level 1).
  if (name.includes('nivel 1.0') || name.includes('contraste')) return 2
  if (name.includes('nivel 1.1') || name.includes('nivel 1.2') || name.includes('referencia'))
    return 5
  if (
    name.includes('nivel 1.3') ||
    name.includes('nivel 1.4') ||
    name.includes('cromático completo')
  )
    return 12

  // 2c. Alias de presets de notas sueltas (niveles enteros, octava
  //     diatónica, cromático, pentatónica) → longitud del preset canónico.
  const legacyNotePreset = matchLegacyNotePreset(name)
  if (legacyNotePreset) return legacyNotePreset.notes.length

  // 2d. Notas personalizadas "notas (N)" / "notas personalizadas (N)".
  const custom = name.match(/notas\s*(?:personalizadas)?\s*\((\d+)\)/i)
  if (custom) {
    return Math.max(2, parseInt(custom[1], 10))
  }

  // 3. Default: conteo empírico de notas únicas esperadas con piso 2.
  const uniqueExpected = new Set(
    (answers || []).filter((a) => a.sessionId === session.id).map((a) => a.expectedNote)
  ).size
  return Math.max(2, uniqueExpected)
}

/**
 * Resuelve las notas del preset canónico asociado a una sesión, o `null` si
 * no hay coincidencia (canónica exacta ni alias histórico). Consumido por la
 * reconstrucción de prescripción de re-testeo (`reconstructSessionConfig`)
 * para eliminar su mapeo local duplicado preset → notas.
 */
export function resolveSessionPresetNotes(session: DbSessionRecord): number[] | null {
  const content = normalize(contentSegment(session.presetName || ''))

  if (content) {
    const notePreset = EXERCISE_PRESETS.find((p) => normalize(p.name) === content)
    if (notePreset) return [...notePreset.notes]
  }

  const legacyNotePreset = matchLegacyNotePreset((session.presetName || '').toLowerCase())
  if (legacyNotePreset) return [...legacyNotePreset.notes]

  return null
}

/**
 * Matching de preset para los filtros de analítica, canónico-primero:
 * 1. Coincidencia exacta normalizada del segmento de contenido del
 *    `presetName` contra el nombre canónico del target.
 * 2. Fallback: matriz heurística histórica (niveles, pentatónica,
 *    personalizadas, coincidencia directa por subcadena), necesaria para
 *    registros heredados cuyo contenido no reproduce el nombre canónico
 *    completo (p. ej. "Nivel 1.1: Intervalos Clásicos" sin el paréntesis de
 *    semitonos).
 */
export function matchesSessionPreset(session: DbSessionRecord, targetPresetName: string): boolean {
  const target = (targetPresetName || '').toLowerCase()
  const pName = (session.presetName || '').toLowerCase()

  // 1. Coincidencia canónica del segmento de contenido.
  if (target && normalize(contentSegment(session.presetName || '')) === target.trim()) {
    return true
  }

  // 2. Matriz heurística histórica (fallback defensivo).
  const isLevel3 =
    (target.includes('nivel 3') || target.includes('octava diatónica')) &&
    (pName.includes('nivel 3') || pName.includes('octava diatónica') || pName.includes('c4 a c5'))
  const isLevel1 = target.includes('nivel 1') && pName.includes('nivel 1')
  const isLevel2 = target.includes('nivel 2') && pName.includes('nivel 2')
  const isLevel4 =
    (target.includes('nivel 4') || target.includes('cromático')) &&
    (pName.includes('nivel 4') || pName.includes('cromático'))
  const isPentatonic = target.includes('pentatónica') && pName.includes('pentatónica')
  const isCustom =
    target.includes('personalizadas') &&
    (pName.includes('personalizadas') || pName.includes('notas ('))
  const isDirectMatch = pName.includes(target)

  return isLevel3 || isLevel1 || isLevel2 || isLevel4 || isPentatonic || isCustom || isDirectMatch
}
