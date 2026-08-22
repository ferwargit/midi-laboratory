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

export type SortDirection = 'asc' | 'desc'

export type AnalyticsTabKey =
  'sessions' | 'ai_report' | 'longitudinal' | 'confusions' | 'charts' | 'ai_history'
