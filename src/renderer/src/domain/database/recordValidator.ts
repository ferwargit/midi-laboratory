import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord, DbAiConsultationRecord } from './types'

export function isValidSessionRecord(session: unknown): session is DbSessionRecord {
  if (!session || typeof session !== 'object') return false
  const s = session as Record<string, unknown>

  if (typeof s.id !== 'string' || s.id.trim().length === 0) return false
  if (typeof s.createdAt !== 'string' || Number.isNaN(Date.parse(s.createdAt))) return false
  if (typeof s.strategyId !== 'string' || s.strategyId.trim().length === 0) return false
  if (typeof s.instrumentId !== 'string' || s.instrumentId.trim().length === 0) return false
  if (typeof s.presetName !== 'string' || s.presetName.trim().length === 0) return false

  if (
    typeof s.totalQuestions !== 'number' ||
    s.totalQuestions <= 0 ||
    !Number.isInteger(s.totalQuestions)
  )
    return false
  if (
    typeof s.correctAnswers !== 'number' ||
    s.correctAnswers < 0 ||
    s.correctAnswers > s.totalQuestions
  )
    return false
  if (
    typeof s.accuracyPercentage !== 'number' ||
    s.accuracyPercentage < 0 ||
    s.accuracyPercentage > 100
  )
    return false
  if (typeof s.avgResponseTimeMs !== 'number' || s.avgResponseTimeMs < 0) return false
  if (typeof s.durationSeconds !== 'number' || s.durationSeconds < 0) return false

  return true
}

export function isValidAnswerRecord(answer: unknown): answer is DbAnswerRecord {
  if (!answer || typeof answer !== 'object') return false
  const a = answer as Record<string, unknown>

  if (typeof a.id !== 'string' || a.id.trim().length === 0) return false
  if (typeof a.sessionId !== 'string' || a.sessionId.trim().length === 0) return false
  if (
    typeof a.questionIndex !== 'number' ||
    a.questionIndex <= 0 ||
    !Number.isInteger(a.questionIndex)
  )
    return false

  if (
    typeof a.expectedNote !== 'number' ||
    a.expectedNote < 0 ||
    a.expectedNote > 127 ||
    !Number.isInteger(a.expectedNote)
  )
    return false
  if (
    typeof a.playedNote !== 'number' ||
    a.playedNote < 0 ||
    a.playedNote > 127 ||
    !Number.isInteger(a.playedNote)
  )
    return false

  if (typeof a.isCorrect !== 'boolean') return false
  if (typeof a.semitoneDistance !== 'number' || !Number.isInteger(a.semitoneDistance)) return false
  if (typeof a.responseTimeMs !== 'number' || a.responseTimeMs < 0) return false
  if (typeof a.velocity !== 'number' || a.velocity < 0 || a.velocity > 127) return false
  if (typeof a.createdAt !== 'string' || Number.isNaN(Date.parse(a.createdAt))) return false

  // Validación de fuente de entrada si está presente
  if (a.inputSource !== undefined) {
    if (a.inputSource !== 'midi_hardware' && a.inputSource !== 'virtual_ui') {
      return false
    }
  }

  return true
}

export function isValidAiReportRecord(report: unknown): report is DbAiReportRecord {
  if (!report || typeof report !== 'object') return false
  const r = report as Record<string, unknown>

  if (typeof r.id !== 'string' || r.id.trim().length === 0) return false
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) return false
  if (typeof r.modelName !== 'string' || r.modelName.trim().length === 0) return false
  if (typeof r.modeFilter !== 'string' || r.modeFilter.trim().length === 0) return false
  if (typeof r.analysisText !== 'string' || r.analysisText.trim().length === 0) return false
  if (!r.prescription || typeof r.prescription !== 'object') return false

  return true
}

export function isValidAiConsultationRecord(
  consultation: unknown
): consultation is DbAiConsultationRecord {
  if (!consultation || typeof consultation !== 'object') return false
  const c = consultation as Record<string, unknown>

  if (typeof c.id !== 'string' || c.id.trim().length === 0) return false
  if (typeof c.createdAt !== 'string' || Number.isNaN(Date.parse(c.createdAt))) return false
  if (typeof c.modelName !== 'string' || c.modelName.trim().length === 0) return false
  if (typeof c.modeFilter !== 'string' || c.modeFilter.trim().length === 0) return false
  if (typeof c.userQuery !== 'string' || c.userQuery.trim().length === 0) return false
  if (typeof c.aiResponse !== 'string' || c.aiResponse.trim().length === 0) return false

  return true
}
