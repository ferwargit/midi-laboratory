import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { AiExercisePrescription } from '../ai/types'
import { EXERCISE_PRESETS } from '../music/presets'
import { DetailedSessionAnalysis, LongitudinalComparison } from './types'
import { isIntervalSession, isSequenceSession } from './sessionClassification'

export function reconstructSessionConfig(
  session: DbSessionRecord,
  allAnswers: DbAnswerRecord[]
): AiExercisePrescription {
  const sessionAnswers = allAnswers.filter((a) => a.sessionId === session.id)

  let targetMode: 'single_note' | 'intervals' | 'sequences' = 'single_note'
  if (session.targetMode && session.targetMode !== 'repertoire') {
    targetMode = session.targetMode
  } else if (isIntervalSession(session)) {
    targetMode = 'intervals'
  } else if (isSequenceSession(session)) {
    targetMode = 'sequences'
  }

  let recommendedNotes: number[] = [60, 62, 64]
  let recommendedIntervals: number[] | undefined = undefined
  let sequenceLength: number | undefined = undefined

  const pName = (session.presetName || '').toLowerCase()

  if (targetMode === 'single_note') {
    if (pName.includes('nivel 1')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_1_c_d_e')?.notes || [60, 62, 64])
      ]
    } else if (pName.includes('nivel 2')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_2_c_to_g')?.notes || [60, 62, 64, 65, 67])
      ]
    } else if (pName.includes('nivel 3') || pName.includes('octava diatónica')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_3_octave_diatonic')?.notes || [
          60, 62, 64, 65, 67, 69, 71, 72
        ])
      ]
    } else if (pName.includes('nivel 4') || pName.includes('cromático')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_4_octave_chromatic')?.notes || [
          60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
        ])
      ]
    } else if (pName.includes('pentatónica')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'pentatonic_c_major')?.notes || [
          60, 62, 64, 67, 69, 72
        ])
      ]
    } else {
      const uniqueNotes = Array.from(new Set(sessionAnswers.map((a) => a.expectedNote))).sort(
        (a, b) => a - b
      )
      recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64]
    }
  } else if (targetMode === 'intervals') {
    const stList: number[] = []
    sessionAnswers.forEach((a) => {
      const match = a.reasonTelemetry.match(/(\d+)\s*st/i)
      if (match) stList.push(parseInt(match[1], 10))
    })
    recommendedIntervals = Array.from(new Set(stList)).sort((a, b) => a - b)
    if (recommendedIntervals.length === 0) recommendedIntervals = [2, 4, 5, 7, 12]
  } else if (targetMode === 'sequences') {
    const candidateSet = new Set<number>()
    let detectedLength = 3

    sessionAnswers.forEach((a) => {
      const seqMatch = a.reasonTelemetry.match(/Secuencia:\s*\[([^\]]+)\]/i)
      if (seqMatch && seqMatch[1]) {
        const parsedNotes = seqMatch[1]
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n))

        parsedNotes.forEach((n) => candidateSet.add(n))
        if (parsedNotes.length >= 3) {
          detectedLength = parsedNotes.length
        }
      } else if (a.expectedNote) {
        candidateSet.add(a.expectedNote)
      }
    })

    const uniqueNotes = Array.from(candidateSet).sort((a, b) => a - b)
    recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64, 65, 67]
    sequenceLength = detectedLength
  }

  const isTimed = pName.includes('tiempo') || pName.includes('cronometrado')
  const isMastery = pName.includes('maestría')

  const limitType = isTimed ? 'time' : isMastery ? 'mastery' : 'questions'
  const durationMinutes = Math.max(1, Math.round((session.durationSeconds || 60) / 60))
  const questionsCount = session.totalQuestions || 10

  const validInstruments = ['acoustic_grand_piano', 'flute', 'violin', 'clarinet', 'acoustic_bass']
  const instrumentId = validInstruments.includes(session.instrumentId)
    ? (session.instrumentId as AiExercisePrescription['instrumentId'])
    : 'acoustic_grand_piano'

  return {
    title: `Re-testeo: ${session.presetName}`,
    rationale: `Sesión clonada de tu registro histórico (${new Date(session.createdAt).toLocaleDateString('es-AR')}) para evaluar evolución longitudinal bajo las mismas condiciones.`,
    targetMode,
    instrumentId,
    recommendedNotes,
    recommendedIntervals,
    sequenceLength,
    limitType,
    questionsCount,
    durationMinutes,
    advanceMode: 'smart',
    noteDurationMs: 500
  }
}

export function computeLongitudinalComparisons(
  sessionDetails: DetailedSessionAnalysis[]
): LongitudinalComparison[] {
  const groups = new Map<string, DetailedSessionAnalysis[]>()

  sessionDetails.forEach((item) => {
    let contentKey = item.session.presetName || 'General'
    if (contentKey.includes('•')) {
      contentKey = contentKey.split('•')[0].trim()
    }
    const groupKey = `${item.session.instrumentId}_${contentKey}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(item)
  })

  const comparisons: LongitudinalComparison[] = []

  groups.forEach((items) => {
    if (items.length < 2) return

    const sorted = [...items].sort(
      (a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime()
    )

    const baseline = sorted[0]
    const latest = sorted[sorted.length - 1]

    let contentName = latest.session.presetName || ''
    if (contentName.includes('•')) {
      contentName = contentName.split('•')[0].trim()
    }

    const rawAccuracyDelta = latest.session.accuracyPercentage - baseline.session.accuracyPercentage
    const normalizedAccuracyDelta = latest.normalizedAccuracy - baseline.normalizedAccuracy
    const responseTimeDeltaMs =
      latest.session.avgResponseTimeMs - baseline.session.avgResponseTimeMs
    const rpmDelta = Number((latest.responsesPerMinute - baseline.responsesPerMinute).toFixed(1))

    const isImproved =
      rawAccuracyDelta > 0 || (rawAccuracyDelta === 0 && responseTimeDeltaMs < -100)

    // Corrección F-09 (Auditoría Frente 3): totalAttempts debe acumular el
    // total de preguntas evaluadas a lo largo del grupo, no la cantidad de
    // sesiones que lo componen.
    const totalAttempts = items.reduce((acc, it) => acc + (it.session.totalQuestions || 0), 0)

    comparisons.push({
      contentName,
      baselineSession: baseline.session,
      latestSession: latest.session,
      totalAttempts,
      rawAccuracyDelta,
      normalizedAccuracyDelta,
      responseTimeDeltaMs,
      rpmDelta,
      isImproved
    })
  })

  return comparisons
}
