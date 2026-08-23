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

/**
 * Extrae una cadena JSON de objeto balanceada { ... } ignorando llaves dentro de strings.
 */
export function extractBalancedJsonObject(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null

  // 1. Purgar bloques de pensamiento <think>...</think> típicos de modelos de razonamiento (DeepSeek/Qwen)
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Si existe un bloque cercado ```json ... ```, extraerlo prioritariamente
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim()
  } else {
    // Quitar cercas genéricas ``` ... ```
    text = text.replace(/```\s*([\s\S]*?)\s*```/g, '$1').trim()
  }

  const startIdx = text.indexOf('{')
  if (startIdx === -1) return null

  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i]

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (char === '\\') {
      isEscaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0) {
          return text.substring(startIdx, i + 1)
        }
      }
    }
  }

  return null
}

export function validateAndParseAiResponse(
  rawJsonString: string,
  modelName: string
): AiAnalysisResponse | null {
  if (!rawJsonString || typeof rawJsonString !== 'string') return null

  try {
    const jsonCandidate = extractBalancedJsonObject(rawJsonString)
    if (!jsonCandidate) return null

    const parsed = JSON.parse(jsonCandidate)

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
