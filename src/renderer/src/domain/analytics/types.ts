import { DbSessionRecord } from '../database/types'

export type AnalyticsModeFilter = 'all' | 'single_note' | 'intervals' | 'sequences' | 'repertoire'
export type AnalyticsMasteryFilter = 'all' | 'mastered' | 'learning' | 'critical'

export interface AnalyticsFilterOptions {
  mode: AnalyticsModeFilter
  instrumentId?: string
  strategyId?: string
  presetFilter?: string
  format?: string
  mastery?: AnalyticsMasteryFilter
  inputSource?: 'all' | 'hardware' | 'virtual'
  biasFilter?: 'all' | 'sharp' | 'flat' | 'balanced'
  poolSizeFilter?: string
  isiFilter?: 'all' | 'massed' | 'optimal' | 'spaced'
  searchQuery?: string
}

export interface ConfusionPair {
  expected: string
  played: string
  count: number
}

export interface SessionPsychometrics {
  sessionId: string
  poolSize: number
  entropyBits: number
  chanceBaseline: number
  rawAccuracy: number
  normalizedAccuracy: number
  durationSeconds: number
  responsesPerMinute: number
}

export interface SessionFormatInfo {
  formatType: 'time' | 'mastery' | 'questions' | 'infinite'
  formatLabel: string
  nominalMinutes?: number
  nominalQuestions?: number
}

export interface InterSessionGapInfo {
  gapMs: number | null
  label: string
}

export interface DetailedSessionAnalysis {
  session: DbSessionRecord
  poolSize: number
  entropyBits: number
  chanceBaseline: number
  normalizedAccuracy: number
  responsesPerMinute: number
  fastPercent: number
  mediumPercent: number
  slowPercent: number
  sharpBiasCount: number
  flatBiasCount: number
  dominantBias: 'sharp' | 'flat' | 'balanced'
  formatType: 'time' | 'mastery' | 'questions' | 'infinite'
  formatLabel: string
  inputMethod: 'hardware' | 'virtual' | 'mixed'
  interSessionGapMs: number | null
  interSessionGapLabel: string
  cpiScore: number
}

export interface QuestionTelemetryPoint {
  questionIndex: number
  expectedNote: number
  expectedName: string
  playedNote: number
  playedName: string
  isCorrect: boolean
  semitoneDistance: number
  responseTimeMs: number
  velocity: number
  inputSource?: 'midi_hardware' | 'virtual_ui'
  movingAvgLatencyMs: number
  preAnswerListens: number
  postErrorListens: number
  postErrorDwellTimeMs: number
}

export interface SessionTimelineAnalysis {
  session: DbSessionRecord
  questions: QuestionTelemetryPoint[]
  totalQuestions: number
  correctCount: number
  errorCount: number
  overallAccuracy: number
  avgLatencyMs: number
  warmUpErrorsCount: number
  postErrorSlowingAvgDeltaMs: number | null
  firstHalfAccuracy: number
  secondHalfAccuracy: number
  firstHalfAvgLatencyMs: number
  secondHalfAvgLatencyMs: number
  fatigueDetected: boolean
  fastReflexCount: number
  activeNotes: number[]
  totalPreAnswerListens: number
  totalPostErrorListens: number
  firstListenConfidencePercent: number
  errorRepairRatePercent: number
  avgPostErrorDwellTimeMs: number
  repairEffectivenessPercent: number | null
}

export interface PitchClassConfusionCell {
  expectedPc: number
  playedPc: number
  expectedName: string
  playedName: string
  count: number
  percentageOfExpected: number
  isDiagonal: boolean
}

export interface ConfusionMatrix2DData {
  pitchClasses: readonly string[]
  grid: PitchClassConfusionCell[][]
  totalTestsPerPitchClass: number[]
  maxOffDiagonalCount: number
}

export interface PerNoteLatencyStat {
  noteNumber: number
  noteName: string
  octave: number
  totalAttempts: number
  correctAttempts: number
  accuracyPercentage: number
  avgLatencyMs: number
  fastReflexPercent: number
}

export interface OctaveLatencySummary {
  octave: number
  octaveLabel: string
  avgLatencyMs: number
  totalNotes: number
  totalAttempts: number
}

export interface PerNoteLatencyAnalysis {
  notes: PerNoteLatencyStat[]
  octaves: OctaveLatencySummary[]
  fastestNote: PerNoteLatencyStat | null
  slowestNote: PerNoteLatencyStat | null
  fastestOctave: OctaveLatencySummary | null
}

export interface LongitudinalComparison {
  contentName: string
  baselineSession: DbSessionRecord
  latestSession: DbSessionRecord
  totalAttempts: number
  rawAccuracyDelta: number
  normalizedAccuracyDelta: number
  responseTimeDeltaMs: number
  rpmDelta: number
  isImproved: boolean
}

export interface AnalyticsMetrics {
  modeFilter: AnalyticsModeFilter
  filteredSessionsCount: number
  totalAnswers: number
  totalCorrect: number
  overallAccuracy: number
  normalizedOverallAccuracy: number
  avgEntropyBits: number
  avgResponseTimeMs: number
  fastResponsesCount: number
  mediumResponsesCount: number
  slowResponsesCount: number
  sharpBiasCount: number
  flatBiasCount: number
  topConfusions: ConfusionPair[]
  mostDifficultNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
  strongestNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
  sessionPsychometricsList: DetailedSessionAnalysis[]
  longitudinalComparisons: LongitudinalComparison[]
}
