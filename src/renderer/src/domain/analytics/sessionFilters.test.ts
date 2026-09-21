import { describe, it, expect } from 'vitest'
import { filterSessionsAdvanced } from './sessionFilters'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

function makeSession(partial: Partial<DbSessionRecord> = {}): DbSessionRecord {
  return {
    id: 's_base',
    createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'acoustic_grand_piano',
    presetName: 'Nivel 1 (C, D, E)',
    totalQuestions: 10,
    correctAnswers: 8,
    accuracyPercentage: 80,
    avgResponseTimeMs: 1200,
    durationSeconds: 60,
    ...partial
  }
}

function makeAnswer(partial: Partial<DbAnswerRecord> = {}): DbAnswerRecord {
  return {
    id: 'a_base',
    sessionId: 's_base',
    questionIndex: 0,
    expectedNote: 60,
    playedNote: 60,
    isCorrect: true,
    semitoneDistance: 0,
    responseTimeMs: 1000,
    velocity: 90,
    reasonTelemetry: '',
    createdAt: new Date('2026-09-01T10:01:00Z').toISOString(),
    inputSource: 'midi_hardware',
    ...partial
  }
}

describe('sessionFilters - filterSessionsAdvanced', () => {
  describe('1. Modalidad estricta', () => {
    const sessions = [
      makeSession({ id: 'm_single', strategyId: 'adaptive_v1', presetName: 'Nivel 1 (C, D, E)' }),
      makeSession({
        id: 'm_interval',
        strategyId: 'intervals_v1',
        presetName: 'Nivel 1.1: Intervalos Clásicos'
      }),
      makeSession({
        id: 'm_seq',
        instrumentId: 'piano_sequences',
        presetName: 'Secuencias (3 notas)'
      }),
      makeSession({ id: 'm_rep', strategyId: 'repertoire_v1', presetName: 'Partitura: Canto' })
    ]

    it('filtra solo sesiones de nota simple con mode single_note', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'single_note' })
      expect(out.map((s) => s.id)).toEqual(['m_single'])
    })

    it('filtra solo sesiones de intervalos con mode intervals', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'intervals' })
      expect(out.map((s) => s.id)).toEqual(['m_interval'])
    })

    it('filtra solo sesiones de secuencias con mode sequences', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'sequences' })
      expect(out.map((s) => s.id)).toEqual(['m_seq'])
    })

    it('filtra solo sesiones de repertorio con mode repertoire', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'repertoire' })
      expect(out.map((s) => s.id)).toEqual(['m_rep'])
    })

    it('mode all no descarta ninguna sesión', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all' })
      expect(out).toHaveLength(4)
    })
  })

  describe('2. Instrumento', () => {
    const sessions = [
      makeSession({ id: 'ins_piano', instrumentId: 'acoustic_grand_piano' }),
      makeSession({ id: 'ins_flute', instrumentId: 'flute' }),
      makeSession({ id: 'ins_violin', instrumentId: 'violin' })
    ]

    it('mantiene solo las sesiones del instrumento seleccionado', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', instrumentId: 'flute' })
      expect(out.map((s) => s.id)).toEqual(['ins_flute'])
    })

    it('instrumentId all no filtra por instrumento', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', instrumentId: 'all' })
      expect(out).toHaveLength(3)
    })

    it('instrumentId indefinido no filtra por instrumento', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all' })
      expect(out).toHaveLength(3)
    })
  })

  describe('3. Estrategia / Motor', () => {
    const sessions = [
      makeSession({ id: 'st_adaptive', strategyId: 'adaptive_v1' }),
      makeSession({ id: 'st_spaced', strategyId: 'spaced_repetition' }),
      makeSession({ id: 'st_random', strategyId: 'random' })
    ]

    it('mantiene solo las sesiones de la estrategia seleccionada', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', strategyId: 'spaced_repetition' })
      expect(out.map((s) => s.id)).toEqual(['st_spaced'])
    })

    it('strategyId all no filtra por estrategia', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', strategyId: 'all' })
      expect(out).toHaveLength(3)
    })
  })

  describe('4. Preset / Contenido Musical', () => {
    const sessions = [
      makeSession({ id: 'p_l1', presetName: 'Nivel 1 (C, D, E)' }),
      makeSession({ id: 'p_l2', presetName: 'Nivel 2 (C a G)' }),
      makeSession({ id: 'p_l3', presetName: 'Nivel 3 (C4 a C5)' }),
      makeSession({ id: 'p_oct', presetName: 'Octava Diatónica (C4 a C5)' }),
      makeSession({ id: 'p_l4', presetName: 'Nivel 4 (Cromático C4-C5)' }),
      makeSession({ id: 'p_chrom', presetName: 'Todos los 12 Intervalos (Cromático)' }),
      makeSession({ id: 'p_pent', presetName: 'Pentatónica de Do' }),
      makeSession({ id: 'p_custom', presetName: 'Notas Personalizadas (4)' }),
      makeSession({ id: 'p_notes', presetName: 'Mis Notas (7)' }),
      makeSession({ id: 'p_direct', presetName: 'Nivel 1.1: Intervalos Clásicos' })
    ]

    it('nivel 1 matchea por subcadena de nivel (colisión con "nivel 1.1")', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Nivel 1' })
      expect(out.map((s) => s.id)).toEqual(['p_l1', 'p_direct'])
    })

    it('nivel 2 matchea por alias de nivel', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Nivel 2' })
      expect(out.map((s) => s.id)).toEqual(['p_l2'])
    })

    it('nivel 3 matchea tanto a "nivel 3" como a "octava diatónica"', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Nivel 3' }).map((s) => s.id)
      ).toEqual(['p_l3', 'p_oct'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Octava Diatónica' }).map(
          (s) => s.id
        )
      ).toEqual(['p_l3', 'p_oct'])
    })

    it('nivel 4 / cromático matchea por alias de nivel y por cromático', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Nivel 4' }).map((s) => s.id)
      ).toEqual(['p_l4', 'p_chrom'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Cromático' }).map(
          (s) => s.id
        )
      ).toEqual(['p_l4', 'p_chrom'])
    })

    it('pentatónica matchea por nombre directo', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Pentatónica' })
      expect(out.map((s) => s.id)).toEqual(['p_pent'])
    })

    it('personalizadas matchea a "personalizadas" y a "notas ("', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Personalizadas' })
      expect(out.map((s) => s.id)).toEqual(['p_custom', 'p_notes'])
    })

    it('coincidencia directa (isDirectMatch) cuando no aplica ningún alias', () => {
      const out = filterSessionsAdvanced(sessions, {
        mode: 'all',
        presetFilter: 'Intervalos Clásicos'
      })
      expect(out.map((s) => s.id)).toEqual(['p_direct'])
    })

    it('presetFilter all no filtra por preset', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'all' })
      expect(out).toHaveLength(sessions.length)
    })

    it('un preset que no coincide con ningún alias ni directamente se descarta', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', presetFilter: 'Nivel 2' })
      expect(out.map((s) => s.id)).not.toContain('p_l3')
    })

    it('un presetName vacío nunca coincide con un alias de nivel', () => {
      const withEmpty = [...sessions, makeSession({ id: 'p_empty', presetName: '' })]
      const out = filterSessionsAdvanced(withEmpty, { mode: 'all', presetFilter: 'Nivel 1' })
      expect(out.map((s) => s.id)).toEqual(['p_l1', 'p_direct'])
    })
  })

  describe('5. Formato y Duración', () => {
    const sessions = [
      makeSession({ id: 'f_t1', presetName: 'Cronometrado 1m', durationSeconds: 60 }),
      makeSession({ id: 'f_t3', presetName: 'Cronometrado 3m', durationSeconds: 180 }),
      makeSession({ id: 'f_t5', presetName: 'Tiempo 5m', durationSeconds: 300 }),
      makeSession({ id: 'f_t10', presetName: 'Cronometrado 10 min', durationSeconds: 600 }),
      makeSession({ id: 'f_q5', presetName: 'Bloque 5 preguntas', totalQuestions: 5 }),
      makeSession({ id: 'f_q10', presetName: 'Bloque 10 preguntas', totalQuestions: 10 }),
      makeSession({ id: 'f_q20', presetName: 'Bloque 20 preguntas', totalQuestions: 20 }),
      makeSession({ id: 'f_qserie', presetName: 'Serie 15', totalQuestions: 15 }),
      makeSession({ id: 'f_mastery', presetName: 'Maestría de Notas' })
    ]

    it('time_all mantiene todas las sesiones cronometradas', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'time_all' })
      expect(out.map((s) => s.id)).toEqual(['f_t1', 'f_t3', 'f_t5', 'f_t10'])
    })

    it('time (generico) equivale a time_all', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'time' })
      expect(out.map((s) => s.id)).toEqual(['f_t1', 'f_t3', 'f_t5', 'f_t10'])
    })

    it('time_1 / time_3 / time_5 / time_10 filtran por minutos nominales', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'time_1' }).map((s) => s.id)
      ).toEqual(['f_t1'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'time_3' }).map((s) => s.id)
      ).toEqual(['f_t3'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'time_5' }).map((s) => s.id)
      ).toEqual(['f_t5'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'time_10' }).map((s) => s.id)
      ).toEqual(['f_t10'])
    })

    it('questions_all mantiene todas las sesiones por preguntas', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'questions_all' })
      expect(out.map((s) => s.id)).toEqual(['f_q5', 'f_q10', 'f_q20', 'f_qserie'])
    })

    it('questions (generico) equivale a questions_all', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'questions' })
      expect(out.map((s) => s.id)).toEqual(['f_q5', 'f_q10', 'f_q20', 'f_qserie'])
    })

    it('questions_5 / questions_10 / questions_20 filtran por cantidad nominal', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'questions_5' }).map((s) => s.id)
      ).toEqual(['f_q5'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'questions_10' }).map((s) => s.id)
      ).toEqual(['f_q10'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', format: 'questions_20' }).map((s) => s.id)
      ).toEqual(['f_q20'])
    })

    it('mastery mantiene solo las sesiones de maestría', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'mastery' })
      expect(out.map((s) => s.id)).toEqual(['f_mastery'])
    })

    it('format all no filtra por formato', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'all' })
      expect(out).toHaveLength(sessions.length)
    })

    it('un formato no reconocido es no-op (no descarta ni coincide)', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', format: 'unknown_format' })
      expect(out).toHaveLength(sessions.length)
    })
  })

  describe('6. Carga / Tamaño de Pool', () => {
    const sessions = [
      makeSession({ id: 'pool_l1', presetName: 'Nivel 1 (C, D, E)' }),
      makeSession({ id: 'pool_l2', presetName: 'Nivel 2 (C a G)' }),
      makeSession({ id: 'pool_l3', presetName: 'Nivel 3 (C4 a C5)' }),
      makeSession({ id: 'pool_l4', presetName: 'Nivel 4 (Cromático)' }),
      makeSession({ id: 'pool_pent', presetName: 'Pentatónica de Do' }),
      makeSession({ id: 'pool_custom', presetName: 'Notas Personalizadas (4)' }),
      makeSession({ id: 'pool_free', presetName: 'Entrenamiento Libre' })
    ]

    it('matchea el pool nominal de cada nivel y preset', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '3' }).map((s) => s.id)
      ).toEqual(['pool_l1'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '5' }).map((s) => s.id)
      ).toEqual(['pool_l2'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '8' }).map((s) => s.id)
      ).toEqual(['pool_l3'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '13' }).map((s) => s.id)
      ).toEqual(['pool_l4'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '6' }).map((s) => s.id)
      ).toEqual(['pool_pent'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '4' }).map((s) => s.id)
      ).toEqual(['pool_custom'])
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: '2' }).map((s) => s.id)
      ).toEqual(['pool_free'])
    })

    it('poolSizeFilter all no filtra por tamaño de pool', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', poolSizeFilter: 'all' })
      expect(out).toHaveLength(sessions.length)
    })
  })

  describe('7. Nivel de Dominio', () => {
    const sessions = [
      makeSession({ id: 'dom_90', accuracyPercentage: 90 }),
      makeSession({ id: 'dom_80', accuracyPercentage: 80 }),
      makeSession({ id: 'dom_70', accuracyPercentage: 70 }),
      makeSession({ id: 'dom_50', accuracyPercentage: 50 })
    ]

    it('mastered mantiene accuracy >= 85', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', mastery: 'mastered' })
      expect(out.map((s) => s.id)).toEqual(['dom_90'])
    })

    it('learning mantiene accuracy en [60, 85)', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', mastery: 'learning' })
      expect(out.map((s) => s.id)).toEqual(['dom_80', 'dom_70'])
    })

    it('critical mantiene accuracy < 60', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', mastery: 'critical' })
      expect(out.map((s) => s.id)).toEqual(['dom_50'])
    })
  })

  describe('8. Búsqueda por Texto', () => {
    const sessions = [
      makeSession({ id: 'q_name', presetName: 'Intervalos Clásicos', instrumentId: 'flute' }),
      makeSession({ id: 'q_inst', presetName: 'Nivel 1', instrumentId: 'acoustic_bass' }),
      makeSession({ id: 'q_strat', presetName: 'Nivel 2', strategyId: 'spaced_repetition' }),
      makeSession({ id: 'q_none', presetName: 'Nivel 3', instrumentId: 'violin' })
    ]

    it('coincide por nombre de preset', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: 'intervalos' })
      expect(out.map((s) => s.id)).toEqual(['q_name'])
    })

    it('coincide por instrumento', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: 'bass' })
      expect(out.map((s) => s.id)).toEqual(['q_inst'])
    })

    it('coincide por estrategia', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: 'spaced' })
      expect(out.map((s) => s.id)).toEqual(['q_strat'])
    })

    it('coincide parcialmente y sin distinguir mayúsculas', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: 'INTERVAL' })
      expect(out.map((s) => s.id)).toEqual(['q_name'])
    })

    it('searchQuery vacío o en blanco es no-op', () => {
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: '' }).map((s) => s.id)
      ).toHaveLength(4)
      expect(
        filterSessionsAdvanced(sessions, { mode: 'all', searchQuery: '   ' }).map((s) => s.id)
      ).toHaveLength(4)
    })

    it('excluye sesiones con campos vacíos que no pueden coincidir', () => {
      const withEmpty = [
        ...sessions,
        makeSession({ id: 'q_empty', presetName: '', instrumentId: '', strategyId: '' })
      ]
      const out = filterSessionsAdvanced(withEmpty, { mode: 'all', searchQuery: 'nivel' })
      expect(out.map((s) => s.id)).not.toContain('q_empty')
    })
  })

  describe('9. Fuente de Entrada', () => {
    const sessions = [
      makeSession({ id: 'in_hw', presetName: 'Nivel 1' }),
      makeSession({ id: 'in_virt', presetName: 'Nivel 2' }),
      makeSession({ id: 'in_mix', presetName: 'Nivel 3' })
    ]

    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'a_hw1', sessionId: 'in_hw', inputSource: 'midi_hardware' }),
      makeAnswer({ id: 'a_virt1', sessionId: 'in_virt', inputSource: 'virtual_ui' }),
      makeAnswer({ id: 'a_mix1', sessionId: 'in_mix', inputSource: 'midi_hardware' }),
      makeAnswer({ id: 'a_mix2', sessionId: 'in_mix', inputSource: 'virtual_ui' })
    ]

    it('sin respuestas el filtro es no-op seguro', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', inputSource: 'hardware' })
      expect(out).toHaveLength(3)
    })

    it('hardware mantiene solo sesiones con entradas físicas', () => {
      const out = filterSessionsAdvanced(
        sessions,
        { mode: 'all', inputSource: 'hardware' },
        answers
      )
      expect(out.map((s) => s.id)).toEqual(['in_hw'])
    })

    it('virtual mantiene solo sesiones con entradas virtuales', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', inputSource: 'virtual' }, answers)
      expect(out.map((s) => s.id)).toEqual(['in_virt'])
    })

    it('inputSource all no filtra por método de entrada', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', inputSource: 'all' }, answers)
      expect(out).toHaveLength(3)
    })
  })

  describe('10. Sesgo Direccional Dominante', () => {
    const sessions = [
      makeSession({ id: 'bias_sharp', presetName: 'Nivel 1' }),
      makeSession({ id: 'bias_flat', presetName: 'Nivel 2' }),
      makeSession({ id: 'bias_bal', presetName: 'Nivel 3' })
    ]

    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'b_s1', sessionId: 'bias_sharp', isCorrect: false, semitoneDistance: 2 }),
      makeAnswer({ id: 'b_s2', sessionId: 'bias_sharp', isCorrect: false, semitoneDistance: 3 }),
      makeAnswer({ id: 'b_f1', sessionId: 'bias_flat', isCorrect: false, semitoneDistance: -2 }),
      makeAnswer({ id: 'b_f2', sessionId: 'bias_flat', isCorrect: false, semitoneDistance: -1 }),
      makeAnswer({ id: 'b_bal1', sessionId: 'bias_bal', isCorrect: false, semitoneDistance: 2 }),
      makeAnswer({ id: 'b_bal2', sessionId: 'bias_bal', isCorrect: false, semitoneDistance: -2 })
    ]

    it('sin respuestas el filtro es no-op seguro', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', biasFilter: 'sharp' })
      expect(out).toHaveLength(3)
    })

    it('sharp mantiene solo la sesión con sesgo hacia arriba', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', biasFilter: 'sharp' }, answers)
      expect(out.map((s) => s.id)).toEqual(['bias_sharp'])
    })

    it('flat mantiene solo la sesión con sesgo hacia abajo', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', biasFilter: 'flat' }, answers)
      expect(out.map((s) => s.id)).toEqual(['bias_flat'])
    })

    it('balanced mantiene solo la sesión sin sesgo dominante', () => {
      const out = filterSessionsAdvanced(sessions, { mode: 'all', biasFilter: 'balanced' }, answers)
      expect(out.map((s) => s.id)).toEqual(['bias_bal'])
    })
  })

  describe('11. Banda de Intervalo Entre Sesiones (ISI)', () => {
    const base = '2026-09-01T10:00:00Z'

    const sessionsForGap = (gapMs: number): DbSessionRecord[] => [
      makeSession({ id: 'isi_first', createdAt: new Date(base).toISOString() }),
      makeSession({
        id: 'isi_second',
        createdAt: new Date(new Date(base).getTime() + gapMs).toISOString()
      })
    ]

    it('la primera sesión de la cronología (gap null) no pertenece a ninguna banda', () => {
      const sessions = sessionsForGap(600000)
      const out = filterSessionsAdvanced(sessions, { mode: 'all', isiFilter: 'massed' })
      expect(out.map((s) => s.id)).toEqual(['isi_second'])
    })

    it('massed mantiene sesiones con gap < MASSED_MAX_MS', () => {
      const sessions = sessionsForGap(600000)
      const out = filterSessionsAdvanced(sessions, { mode: 'all', isiFilter: 'massed' })
      expect(out.map((s) => s.id)).toEqual(['isi_second'])
    })

    it('optimal mantiene sesiones dentro de la banda óptima', () => {
      const sessions = sessionsForGap(86400000)
      const out = filterSessionsAdvanced(sessions, { mode: 'all', isiFilter: 'optimal' })
      expect(out.map((s) => s.id)).toEqual(['isi_second'])
    })

    it('spaced mantiene sesiones con gap > OPTIMAL_MAX_MS', () => {
      const sessions = sessionsForGap(259200000)
      const out = filterSessionsAdvanced(sessions, { mode: 'all', isiFilter: 'spaced' })
      expect(out.map((s) => s.id)).toEqual(['isi_second'])
    })

    it('isiFilter all mantiene toda la cronología', () => {
      const sessions = sessionsForGap(600000)
      const out = filterSessionsAdvanced(sessions, { mode: 'all', isiFilter: 'all' })
      expect(out.map((s) => s.id)).toEqual(['isi_first', 'isi_second'])
    })
  })

  describe('Combinación de filtros', () => {
    it('encadena instrumento, estrategia y búsqueda de forma conjunta', () => {
      const sessions = [
        makeSession({
          id: 'c1',
          instrumentId: 'flute',
          strategyId: 'spaced_repetition',
          presetName: 'Nivel 1 (C, D, E)'
        }),
        makeSession({
          id: 'c2',
          instrumentId: 'flute',
          strategyId: 'adaptive_v1',
          presetName: 'Nivel 2 (C a G)'
        }),
        makeSession({
          id: 'c3',
          instrumentId: 'violin',
          strategyId: 'spaced_repetition',
          presetName: 'Nivel 1 (C, D, E)'
        })
      ]

      const out = filterSessionsAdvanced(sessions, {
        mode: 'all',
        instrumentId: 'flute',
        strategyId: 'spaced_repetition',
        searchQuery: 'nivel 1'
      })
      expect(out.map((s) => s.id)).toEqual(['c1'])
    })
  })
})
