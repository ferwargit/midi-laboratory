import { DbAnswerRecord } from '../database/types'
import { ConfusionMatrix2DData, PitchClassConfusionCell } from './types'

export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const

export function computePitchClassConfusionMatrix(answers: DbAnswerRecord[]): ConfusionMatrix2DData {
  const counts: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0))
  const totalsPerExpected: number[] = Array(12).fill(0)
  let maxOffDiagonal = 0

  for (const ans of answers) {
    if (ans.expectedNote < 0 || ans.playedNote < 0) continue
    const expPc = ans.expectedNote % 12
    const playPc = ans.playedNote % 12

    counts[expPc][playPc] += 1
    totalsPerExpected[expPc] += 1

    if (expPc !== playPc && counts[expPc][playPc] > maxOffDiagonal) {
      maxOffDiagonal = counts[expPc][playPc]
    }
  }

  const grid: PitchClassConfusionCell[][] = []
  for (let exp = 0; exp < 12; exp++) {
    const row: PitchClassConfusionCell[] = []
    for (let play = 0; play < 12; play++) {
      const c = counts[exp][play]
      const totalExp = totalsPerExpected[exp]
      const percentage = totalExp > 0 ? Math.round((c / totalExp) * 100) : 0
      row.push({
        expectedPc: exp,
        playedPc: play,
        expectedName: PITCH_CLASSES[exp],
        playedName: PITCH_CLASSES[play],
        count: c,
        percentageOfExpected: percentage,
        isDiagonal: exp === play
      })
    }
    grid.push(row)
  }

  return {
    pitchClasses: PITCH_CLASSES,
    grid,
    totalTestsPerPitchClass: totalsPerExpected,
    maxOffDiagonalCount: Math.max(1, maxOffDiagonal)
  }
}
