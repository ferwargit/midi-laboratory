import { DbAnswerRecord } from '../database/types'
import { NotePerformance } from '../adaptation/types'
import { midiNoteToName } from '../music/noteUtils'
import { COGNITIVE_LATENCY_THRESHOLDS } from './thresholds'
import { OctaveLatencySummary, PerNoteLatencyAnalysis, PerNoteLatencyStat } from './types'

export function computeNotePerformancesFromAnswers(
  answers: DbAnswerRecord[]
): Map<number, NotePerformance> {
  const map = new Map<number, NotePerformance>()

  for (const ans of answers) {
    if (!map.has(ans.expectedNote)) {
      map.set(ans.expectedNote, {
        noteNumber: ans.expectedNote,
        attempts: 0,
        correct: 0,
        lastResultWasCorrect: null,
        accuracyPercentage: 0,
        weight: 1.0
      })
    }
    const perf = map.get(ans.expectedNote)!
    perf.attempts += 1
    if (ans.isCorrect) {
      perf.correct += 1
      perf.lastResultWasCorrect = true
    } else {
      perf.lastResultWasCorrect = false
    }
    perf.accuracyPercentage = Math.round((perf.correct / perf.attempts) * 100)
  }

  return map
}

/**
 * Computa la Cronometría de Latencia por Nota y el Desglose por Octava
 */
export function computePerNoteLatencyStats(answers: DbAnswerRecord[]): PerNoteLatencyAnalysis {
  const noteMap = new Map<
    number,
    { latencies: number[]; correctCount: number; totalCount: number; fastCount: number }
  >()

  for (const ans of answers) {
    if (ans.expectedNote < 0) continue

    if (!noteMap.has(ans.expectedNote)) {
      noteMap.set(ans.expectedNote, { latencies: [], correctCount: 0, totalCount: 0, fastCount: 0 })
    }

    const item = noteMap.get(ans.expectedNote)!
    item.totalCount++
    if (ans.isCorrect) {
      item.correctCount++
      item.latencies.push(ans.responseTimeMs)
      if (ans.responseTimeMs < COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) {
        item.fastCount++
      }
    }
  }

  const notesList: PerNoteLatencyStat[] = Array.from(noteMap.entries())
    .map(([noteNumber, stat]) => {
      const avgLat =
        stat.latencies.length > 0
          ? Math.round(stat.latencies.reduce((a, b) => a + b, 0) / stat.latencies.length)
          : 0
      const acc = stat.totalCount > 0 ? Math.round((stat.correctCount / stat.totalCount) * 100) : 0
      const fastPct =
        stat.correctCount > 0 ? Math.round((stat.fastCount / stat.correctCount) * 100) : 0
      const octave = Math.floor(noteNumber / 12) - 1

      return {
        noteNumber,
        noteName: midiNoteToName(noteNumber),
        octave,
        totalAttempts: stat.totalCount,
        correctAttempts: stat.correctCount,
        accuracyPercentage: acc,
        avgLatencyMs: avgLat,
        fastReflexPercent: fastPct
      }
    })
    .sort((a, b) => a.noteNumber - b.noteNumber)

  // Resumen por Octava
  const octaveMap = new Map<
    number,
    { sumLat: number; countLat: number; totalAttempts: number; noteCount: number }
  >()

  notesList.forEach((n) => {
    if (!octaveMap.has(n.octave)) {
      octaveMap.set(n.octave, { sumLat: 0, countLat: 0, totalAttempts: 0, noteCount: 0 })
    }
    const o = octaveMap.get(n.octave)!
    o.noteCount++
    o.totalAttempts += n.totalAttempts
    if (n.avgLatencyMs > 0) {
      o.sumLat += n.avgLatencyMs
      o.countLat++
    }
  })

  const octaves: OctaveLatencySummary[] = Array.from(octaveMap.entries())
    .map(([octave, data]) => {
      const label =
        octave === 3
          ? 'Octava 3 (Grave: C3-B3)'
          : octave === 4
            ? 'Octava 4 (Central: C4-B4)'
            : `Octava ${octave} (Aguda)`
      const avg = data.countLat > 0 ? Math.round(data.sumLat / data.countLat) : 0
      return {
        octave,
        octaveLabel: label,
        avgLatencyMs: avg,
        totalNotes: data.noteCount,
        totalAttempts: data.totalAttempts
      }
    })
    .sort((a, b) => a.octave - b.octave)

  const activeValidNotes = notesList.filter((n) => n.correctAttempts > 0 && n.avgLatencyMs > 0)
  const fastestNote =
    activeValidNotes.length > 0
      ? [...activeValidNotes].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0]
      : null
  const slowestNote =
    activeValidNotes.length > 0
      ? [...activeValidNotes].sort((a, b) => b.avgLatencyMs - a.avgLatencyMs)[0]
      : null

  const activeValidOctaves = octaves.filter((o) => o.avgLatencyMs > 0)
  const fastestOctave =
    activeValidOctaves.length > 0
      ? [...activeValidOctaves].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0]
      : null

  return {
    notes: notesList,
    octaves,
    fastestNote,
    slowestNote,
    fastestOctave
  }
}
