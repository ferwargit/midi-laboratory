export type SortColumnKey =
  | 'date'
  | 'content'
  | 'format'
  | 'pool'
  | 'questions'
  | 'duration'
  | 'accuracy'
  | 'normalizedAccuracy'
  | 'fastPercent'
  | 'bias'
  | 'rpm'
  | 'cpi'

export type SortDirection = 'asc' | 'desc'

export type AnalyticsTabKey =
  | 'sessions'
  | 'ai_report'
  | 'ai_consultation'
  | 'longitudinal'
  | 'confusions'
  | 'charts'
  | 'ai_history'
