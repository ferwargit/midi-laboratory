import { create } from 'zustand'
import {
  AnalyticsMetrics,
  AnalyticsModeFilter,
  computeAnalyticsMetrics
} from '../domain/analytics/historyAnalytics'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'

interface AnalyticsState {
  modeFilter: AnalyticsModeFilter
  metrics: AnalyticsMetrics
  setModeFilter: (
    filter: AnalyticsModeFilter,
    sessions: DbSessionRecord[],
    answers: DbAnswerRecord[]
  ) => void
  recomputeMetrics: (sessions: DbSessionRecord[], answers: DbAnswerRecord[]) => void
}

const emptyMetrics: AnalyticsMetrics = {
  modeFilter: 'all',
  filteredSessionsCount: 0,
  totalAnswers: 0,
  totalCorrect: 0,
  overallAccuracy: 0,
  normalizedOverallAccuracy: 0,
  avgEntropyBits: 0,
  avgResponseTimeMs: 0,
  fastResponsesCount: 0,
  mediumResponsesCount: 0,
  slowResponsesCount: 0,
  sharpBiasCount: 0,
  flatBiasCount: 0,
  topConfusions: [],
  mostDifficultNotes: [],
  strongestNotes: [],
  sessionPsychometricsList: [],
  longitudinalComparisons: []
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  modeFilter: 'all',
  metrics: emptyMetrics,

  setModeFilter: (
    modeFilter: AnalyticsModeFilter,
    sessions: DbSessionRecord[],
    answers: DbAnswerRecord[]
  ): void => {
    const metrics = computeAnalyticsMetrics(sessions, answers, modeFilter)
    set({ modeFilter, metrics })
  },

  recomputeMetrics: (sessions: DbSessionRecord[], answers: DbAnswerRecord[]): void => {
    const { modeFilter } = get()
    const metrics = computeAnalyticsMetrics(sessions, answers, modeFilter)
    set({ metrics })
  }
}))
