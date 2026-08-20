import { AiAnalysisResponse, AiExercisePrescription } from './types'
import { sanitizePrescription } from './prescriptionSanitizer'

const VALID_TARGET_MODES = ['single_note', 'intervals', 'sequences'] as const
const VALID_INSTRUMENTS = [
  'acoustic_grand_piano',
  'flute',
  'violin',
  'clarinet',
  'acoustic_bass'
] as const
const VALID_LIMIT_TYPES = ['questions', 'time', 'mastery', 'infinite'] as const
const VALID_ADVANCE_MODES = ['smart', 'manual', 'auto_fast', 'auto_slow'] as const

export function isValidPrescription(obj: unknown): obj is AiExercisePrescription {
  if (!obj || typeof obj !== 'object') return false

  const p = obj as Record<string, unknown>

  if (typeof p.title !== 'string' || p.title.trim().length === 0) return false
  if (typeof p.rationale !== 'string' || p.rationale.trim().length === 0) return false

  if (!VALID_TARGET_MODES.includes(p.targetMode as (typeof VALID_TARGET_MODES)[number]))
    return false
  if (!VALID_INSTRUMENTS.includes(p.instrumentId as (typeof VALID_INSTRUMENTS)[number]))
    return false
  if (!VALID_LIMIT_TYPES.includes(p.limitType as (typeof VALID_LIMIT_TYPES)[number])) return false
  if (!VALID_ADVANCE_MODES.includes(p.advanceMode as (typeof VALID_ADVANCE_MODES)[number]))
    return false

  if (!Array.isArray(p.recommendedNotes) || p.recommendedNotes.length === 0) return false
  const allNotesValid = p.recommendedNotes.every(
    (n) => typeof n === 'number' && Number.isInteger(n) && n >= 21 && n <= 108
  )
  if (!allNotesValid) return false

  if (typeof p.questionsCount !== 'number' || p.questionsCount <= 0) return false
  if (typeof p.durationMinutes !== 'number' || p.durationMinutes <= 0) return false

  return true
}

export function validateAndParseAiResponse(
  rawJsonString: string,
  modelName: string
): AiAnalysisResponse | null {
  if (!rawJsonString || typeof rawJsonString !== 'string') return null

  try {
    const cleaned = rawJsonString
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.analysisText !== 'string' || parsed.analysisText.trim().length === 0) {
      return null
    }

    if (!isValidPrescription(parsed.prescription)) {
      return null
    }

    // Sanitización determinista de octavas y campos
    const sanitizedPrescription = sanitizePrescription(parsed.prescription, parsed.analysisText)

    return {
      source: 'lm_studio_ai',
      modelName,
      analysisText: parsed.analysisText.trim(),
      prescription: sanitizedPrescription
    }
  } catch {
    return null
  }
}
