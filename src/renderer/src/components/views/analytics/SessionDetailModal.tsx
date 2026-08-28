import React, { useMemo, useState } from 'react'
import { DbSessionRecord, DbAnswerRecord } from '../../../domain/database/types'
import {
  analyzeSessionTimeline,
  computeNotePerformancesFromAnswers,
  reconstructSessionConfig,
  COGNITIVE_LATENCY_THRESHOLDS
} from '../../../domain/analytics/historyAnalytics'
import { PianoKeyboard } from '../../trainer/PianoKeyboard'
import { generateMidiRange } from '../../../domain/music/noteUtils'
import { Button } from '../../ui/Button'
import { AiExercisePrescription } from '../../../domain/ai/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

interface SessionDetailModalProps {
  session: DbSessionRecord | null
  answers: DbAnswerRecord[]
  isOpen: boolean
  onClose: () => void
  onReTest: (config: AiExercisePrescription) => void
}

interface HoveredPointInfo {
  x: number
  y: number
  qIndex: number
  expected: string
  played: string
  distance: number
  timeMs: number
  source?: string
  isCorrect: boolean
  preListens: number
  postListens: number
  dwellTimeMs: number
}

export function SessionDetailModal({
  session,
  answers,
  isOpen,
  onClose,
  onReTest
}: SessionDetailModalProps): React.ReactElement | null {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPointInfo | null>(null)

  const sessionAnswers = useMemo(() => {
    if (!session) return []
    return answers.filter((a) => a.sessionId === session.id)
  }, [session, answers])

  const analysis = useMemo(() => {
    if (!session || sessionAnswers.length === 0) return null
    return analyzeSessionTimeline(session, sessionAnswers)
  }, [session, sessionAnswers])

  const notePerformances = useMemo(() => {
    return computeNotePerformancesFromAnswers(sessionAnswers)
  }, [sessionAnswers])

  if (!isOpen || !session) return null

  if (!analysis) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg p-3 md:p-6 animate-in fade-in duration-150">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono text-center select-none">
          <div className="text-3xl">🔬</div>
          <h2 className="text-base font-bold text-zinc-100 m-0">{session.presetName}</h2>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            No se registran respuestas individuales en la base de datos para generar la línea de
            tiempo de esta sesión.
          </p>
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="font-mono text-xs cursor-pointer"
            >
              Cerrar Inspector
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const questions = analysis.questions
  const totalQ = questions.length
  const maxTime = Math.max(3500, ...questions.map((q) => q.responseTimeMs))

  const handleReTestClick = (): void => {
    const config = reconstructSessionConfig(session, answers)
    onReTest(config)
    onClose()
  }

  const tickStep = totalQ <= 20 ? 1 : totalQ <= 40 ? 2 : totalQ <= 70 ? 5 : 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-[1680px] w-full p-5 md:p-6 shadow-2xl space-y-4 max-h-[94vh] overflow-y-auto font-sans select-none">
        {/* 1. CABECERA EXPANDIDA */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-950 border border-sky-600/70 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(56,189,248,0.35)]">
              🔬
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base md:text-lg font-bold text-zinc-100 font-mono m-0">
                  {session.presetName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-sky-400 font-bold">
                  {session.strategyId}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-purple-950/70 border border-purple-800 text-xs font-mono text-purple-300 font-bold">
                  Score CPI: {analysis.session.accuracyPercentage >= 85 ? '🌟' : '🔥'}{' '}
                  {analysis.session.correctAnswers * 12 + analysis.totalQuestions * 2} pts
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-mono mt-1 block">
                📅{' '}
                {new Date(session.createdAt).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}{' '}
                • {analysis.totalQuestions} ejercicios en {session.durationSeconds}s (
                {analysis.overallAccuracy}% precisión)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReTestClick}
              className="px-4 py-2 rounded-xl bg-sky-950/90 hover:bg-sky-900 border border-sky-500/70 text-sky-200 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-105 active:scale-95"
            >
              <span>🔁</span>
              <span>Re-testar esta Sesión</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 text-xl font-mono p-1.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. CUADRÍCULA PRINCIPAL: GRÁFICO PANORÁMICO (IZQ) + SIDEBAR DIAGNÓSTICO (DER) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* LADO IZQUIERDO: LÍNEA DE TIEMPO PANORÁMICA */}
          <div className="lg:col-span-3 p-4 md:p-5 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-3 relative font-mono text-xs shadow-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-sky-400 uppercase tracking-wider text-sm flex items-center gap-2">
                <span>📈</span>
                <span>
                  Línea de Tiempo Micro-Cronológica (Pregunta 1 a {analysis.totalQuestions})
                </span>
              </span>
              <div className="flex items-center gap-4 text-xs font-sans">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(16,185,129,0.8)]" />{' '}
                  Acierto
                </span>
                <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                  <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" /> +st (Agudo)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> -st (Grave)
                </span>
                <span className="flex items-center gap-1.5 text-sky-300 font-semibold">
                  👂 Re-escucha Post-Error
                </span>
              </div>
            </div>

            {/* CONTENEDOR SVG CON MAPAS DE ZONA 1, 2 Y 3 */}
            <div className="h-64 w-full relative pt-2 pb-7">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 900 160"
                preserveAspectRatio="none"
              >
                {(() => {
                  const xStart = 50
                  const xEnd = 880
                  const yTop = 15
                  const yBottom = 135
                  const ySpan = yBottom - yTop

                  const getX = (idx: number): number =>
                    xStart + (idx / Math.max(1, totalQ - 1)) * (xEnd - xStart)
                  const getY = (timeMs: number): number =>
                    yBottom - (Math.min(maxTime, timeMs) / maxTime) * ySpan

                  // BANDA ZONA 1: Calentamiento (Primeras 3 preguntas)
                  const xWarmEnd = getX(Math.min(2, totalQ - 1))

                  // BANDA ZONA 2: Segunda Mitad (Fatiga / Vigilancia)
                  const midIdx = Math.floor(totalQ / 2)
                  const xFatigueStart = getX(midIdx)

                  return (
                    <>
                      {/* Sombra de Fondo Zona 1: Calentamiento */}
                      <rect
                        x={xStart - 10}
                        y={yTop}
                        width={Math.max(30, xWarmEnd - xStart + 20)}
                        height={ySpan}
                        fill="rgba(56, 189, 248, 0.08)"
                        stroke="rgba(56, 189, 248, 0.25)"
                        strokeDasharray="4 4"
                        rx={8}
                      />
                      <text
                        x={xStart + 2}
                        y={yTop + 14}
                        fill="#38bdf8"
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        1. CALENTAMIENTO (Q1-Q3)
                      </text>

                      {/* Sombra de Fondo Zona 2: 2da Mitad (Fatiga) */}
                      {totalQ >= 8 && (
                        <>
                          <rect
                            x={xFatigueStart - 5}
                            y={yTop}
                            width={xEnd - xFatigueStart + 15}
                            height={ySpan}
                            fill={
                              analysis.fatigueDetected
                                ? 'rgba(244, 63, 94, 0.08)'
                                : 'rgba(168, 85, 247, 0.06)'
                            }
                            stroke={
                              analysis.fatigueDetected
                                ? 'rgba(244, 63, 94, 0.3)'
                                : 'rgba(168, 85, 247, 0.2)'
                            }
                            strokeDasharray="4 4"
                            rx={8}
                          />
                          <text
                            x={xFatigueStart + 6}
                            y={yTop + 14}
                            fill={analysis.fatigueDetected ? '#fb7185' : '#c084fc'}
                            fontSize={9}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            2. 2DA MITAD (VIGILANCIA / FATIGA)
                          </text>
                        </>
                      )}

                      {/* Eje Y Líneas Guía */}
                      <line
                        x1={xStart - 15}
                        y1={yTop}
                        x2={xEnd + 10}
                        y2={yTop}
                        stroke="#27272a"
                        strokeWidth="1"
                      />
                      <text x="5" y={yTop + 3} fill="#71717a" fontSize={9} fontFamily="monospace">
                        {(maxTime / 1000).toFixed(1)}s
                      </text>

                      {/* Umbral de Reflejo Inmediato 1.4s */}
                      {COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS <= maxTime && (
                        <>
                          <line
                            x1={xStart - 15}
                            y1={getY(COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS)}
                            x2={xEnd + 10}
                            y2={getY(COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS)}
                            stroke="#10b981"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            opacity="0.6"
                          />
                          <text
                            x="5"
                            y={getY(COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) + 3}
                            fill="#34d399"
                            fontSize={9}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            1.4s
                          </text>
                        </>
                      )}

                      <line
                        x1={xStart - 15}
                        y1={yBottom}
                        x2={xEnd + 10}
                        y2={yBottom}
                        stroke="#3f3f46"
                        strokeWidth="1"
                      />
                      <text
                        x="18"
                        y={yBottom + 3}
                        fill="#71717a"
                        fontSize={9}
                        fontFamily="monospace"
                      >
                        0s
                      </text>

                      {/* Línea de Media Móvil Spline */}
                      {(() => {
                        const pts = questions.map((q, idx) => ({
                          x: getX(idx),
                          y: getY(q.responseTimeMs),
                          yAvg: getY(q.movingAvgLatencyMs),
                          q,
                          idx
                        }))

                        const movingAvgPath = pts
                          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yAvg}`)
                          .join(' ')

                        return (
                          <>
                            <path
                              d={movingAvgPath}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="2"
                              opacity="0.55"
                            />

                            {/* Puntos y Marcadores */}
                            {pts.map((p) => {
                              const color = p.q.isCorrect
                                ? '#10b981'
                                : p.q.semitoneDistance > 0
                                  ? '#c084fc'
                                  : '#f59e0b'

                              const isPostErrorQuestion =
                                p.idx > 0 && !questions[p.idx - 1].isCorrect
                              const hasPostErrorListens = p.q.postErrorListens > 0
                              const showTick =
                                p.q.questionIndex === 1 ||
                                p.q.questionIndex === totalQ ||
                                p.q.questionIndex % tickStep === 0

                              return (
                                <g key={p.idx} className="cursor-pointer group">
                                  <line
                                    x1={p.x}
                                    y1={p.y}
                                    x2={p.x}
                                    y2={yBottom}
                                    stroke={color}
                                    strokeWidth="1"
                                    opacity="0.25"
                                  />

                                  {/* Marcador de Re-escucha Post-Error (👂 xN) */}
                                  {hasPostErrorListens && (
                                    <text
                                      x={p.x}
                                      y={p.y - 12}
                                      fill="#38bdf8"
                                      fontSize="9"
                                      textAnchor="middle"
                                      fontFamily="sans-serif"
                                      fontWeight="bold"
                                    >
                                      👂x{p.q.postErrorListens}
                                    </text>
                                  )}

                                  {/* Marcador de Factor 3 (PES) */}
                                  {isPostErrorQuestion && !hasPostErrorListens && (
                                    <circle
                                      cx={p.x}
                                      cy={p.y - 10}
                                      r={3}
                                      fill="#f59e0b"
                                      stroke="#09090b"
                                      strokeWidth={1}
                                    >
                                      <title>3. Pregunta evaluada tras un error (PES)</title>
                                    </circle>
                                  )}

                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={totalQ > 50 ? 3.5 : 4.5}
                                    fill={color}
                                    stroke="#09090b"
                                    strokeWidth={1.5}
                                    onMouseEnter={(): void =>
                                      setHoveredPoint({
                                        x: p.x,
                                        y: p.y,
                                        qIndex: p.q.questionIndex,
                                        expected: p.q.expectedName,
                                        played: p.q.playedName,
                                        distance: p.q.semitoneDistance,
                                        timeMs: p.q.responseTimeMs,
                                        source: p.q.inputSource,
                                        isCorrect: p.q.isCorrect,
                                        preListens: p.q.preAnswerListens,
                                        postListens: p.q.postErrorListens,
                                        dwellTimeMs: p.q.postErrorDwellTimeMs
                                      })
                                    }
                                    onMouseLeave={(): void => setHoveredPoint(null)}
                                  />

                                  {showTick && (
                                    <text
                                      x={p.x}
                                      y={yBottom + 16}
                                      fill="#a1a1aa"
                                      fontSize="10"
                                      textAnchor="middle"
                                      fontFamily="monospace"
                                      fontWeight="bold"
                                    >
                                      {p.q.questionIndex}
                                    </text>
                                  )}
                                </g>
                              )
                            })}
                          </>
                        )
                      })()}
                    </>
                  )
                })()}
              </svg>

              {/* TOOLTIP FLOTANTE CON TELEMETRÍA METACOGNITIVA */}
              {hoveredPoint && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(85, Math.max(10, (hoveredPoint.x / 900) * 100))}%`,
                    top: '-15px',
                    transform: 'translate(-50%, -100%)'
                  }}
                  className="p-3 bg-zinc-950/95 border border-sky-400 rounded-xl shadow-2xl text-xs font-mono space-y-1.5 z-30 pointer-events-none whitespace-nowrap"
                >
                  <div className="font-bold text-zinc-100 flex justify-between gap-4 border-b border-zinc-800 pb-1">
                    <span>Pregunta #{hoveredPoint.qIndex}</span>
                    <span
                      className={
                        hoveredPoint.isCorrect
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {hoveredPoint.isCorrect ? '✅ Acierto' : '❌ Fallo'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span>
                      Esperada: <strong className="text-sky-300">{hoveredPoint.expected}</strong>
                    </span>
                    <span>
                      Tocaste: <strong className="text-white">{hoveredPoint.played}</strong>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-[11px] text-zinc-400 pt-0.5">
                    <span>
                      Latencia: <strong>{(hoveredPoint.timeMs / 1000).toFixed(2)}s</strong>
                    </span>
                    <span>
                      {hoveredPoint.distance === 0
                        ? 'Afinación Exacta'
                        : `${hoveredPoint.distance > 0 ? `+${hoveredPoint.distance}` : hoveredPoint.distance} st`}
                    </span>
                  </div>
                  {/* Telemetría de Escuchas */}
                  <div className="text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-1 flex justify-between gap-3">
                    <span>
                      🎧 Escuchas previas: <strong>{hoveredPoint.preListens}</strong>
                    </span>
                    {!hoveredPoint.isCorrect && (
                      <span className="text-sky-300">
                        👂 Re-escuchas tras fallo: <strong>{hoveredPoint.postListens}</strong> (
                        {(hoveredPoint.dwellTimeMs / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LADO DERECHO: SIDEBAR DE AUDITORÍA PSICOACÚSTICA (FACTORES 1, 2, 3 Y 4) */}
          <div className="space-y-2.5 font-mono text-xs">
            {/* Factor 1 */}
            <div
              className={`p-3 rounded-xl border space-y-1 ${
                analysis.warmUpErrorsCount === 0
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/30 border-amber-500/50 text-amber-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <strong className="text-[11px] uppercase font-bold">
                  1. Foco Inicial (Warm-Up):
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-[9px] font-bold">
                  Q1 - Q3
                </span>
              </div>
              <p className="text-[11px] font-sans leading-snug m-0">
                {analysis.warmUpErrorsCount === 0
                  ? '✅ 0 fallos al inicio (Concentración auditiva inmediata).'
                  : `⚠️ ${analysis.warmUpErrorsCount} fallo(s) inicial(es) por aclimatación tímbrica.`}
              </p>
            </div>

            {/* Factor 2 */}
            <div
              className={`p-3 rounded-xl border space-y-1 ${
                !analysis.fatigueDetected
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <strong className="text-[11px] uppercase font-bold">2. Fatiga / Vigilancia:</strong>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-[9px] font-bold">
                  2da Mitad
                </span>
              </div>
              <p className="text-[11px] font-sans leading-snug m-0">
                {!analysis.fatigueDetected
                  ? `⚡ Velocidad sostenida (${(analysis.firstHalfAvgLatencyMs / 1000).toFixed(2)}s ➔ ${(analysis.secondHalfAvgLatencyMs / 1000).toFixed(2)}s).`
                  : `⏳ Fatiga Detectada: Latencia subió +${analysis.secondHalfAvgLatencyMs - analysis.firstHalfAvgLatencyMs}ms en la 2da mitad.`}
              </p>
            </div>

            {/* Factor 3 */}
            <div className="p-3 rounded-xl border bg-purple-950/30 border-purple-500/50 text-purple-300 space-y-1">
              <div className="flex justify-between items-center">
                <strong className="text-[11px] uppercase font-bold">3. Post-Error Slowing:</strong>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-[9px] font-bold">PES</span>
              </div>
              <p className="text-[11px] font-sans leading-snug m-0">
                {analysis.postErrorSlowingAvgDeltaMs !== null
                  ? `${analysis.postErrorSlowingAvgDeltaMs > 0 ? `+${analysis.postErrorSlowingAvgDeltaMs}` : analysis.postErrorSlowingAvgDeltaMs}ms de pausa tras fallar (Impacto metacognitivo).`
                  : '🌟 0 fallos en toda la sesión.'}
              </p>
            </div>

            {/* Factor 4 (NUEVO): Conducta Metacognitiva de Reparación (ERI) */}
            <div
              className={`p-3 rounded-xl border space-y-1.5 ${
                analysis.errorRepairRatePercent >= 75
                  ? 'bg-sky-950/40 border-sky-500/60 text-sky-200'
                  : analysis.errorRepairRatePercent >= 40
                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-300'
                    : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <strong className="text-[11px] uppercase font-bold">
                  4. Reparación Post-Error:
                </strong>
                <span className="px-1.5 py-0.2 rounded bg-sky-900/60 text-[9px] font-bold">
                  ERI: {analysis.errorRepairRatePercent}%
                </span>
              </div>
              <div className="text-[11px] font-sans space-y-0.5 leading-snug">
                <div>
                  • Re-escuchaste: <strong>{analysis.totalPostErrorListens} veces</strong> en{' '}
                  {analysis.errorCount} fallos.
                </div>
                <div>
                  • Certeza 1ª Escucha: <strong>{analysis.firstListenConfidencePercent}%</strong>
                </div>
                <div>
                  • Pausa media de análisis:{' '}
                  <strong>{(analysis.avgPostErrorDwellTimeMs / 1000).toFixed(1)}s</strong>
                </div>
                {analysis.repairEffectivenessPercent !== null && (
                  <div className="text-emerald-300 pt-0.5 font-semibold">
                    💡 Efectividad de recuperación: {analysis.repairEffectivenessPercent}% acierto
                    al reaparecer la nota.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. FILA INFERIOR: TECLADO HEATMAP + TABLA PREGUNTA A PREGUNTA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Teclado de esta Sesión */}
          <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="font-bold text-zinc-200 uppercase">
                Mapa de Calor de esta Sesión ({analysis.activeNotes.length} notas activas):
              </span>
              <div className="flex gap-2.5 text-[10px]">
                <span className="text-emerald-400">● &gt;85% Dominada</span>
                <span className="text-amber-400">● 50-85% En progreso</span>
                <span className="text-rose-400">● &lt;50% A reforzar</span>
              </div>
            </div>
            <PianoKeyboard
              keys={PIANO_KEYS}
              activeNotes={analysis.activeNotes}
              performances={notePerformances}
              showHeatmap={true}
              disabled={true}
            />
          </div>

          {/* Tabla Desglosada con Telemetría de Escuchas */}
          <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-zinc-200 uppercase">
                Auditoría Evento a Evento ({questions.length} respuestas):
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {analysis.correctCount} aciertos • {analysis.errorCount} fallos
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 sticky top-0 font-bold text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Esperada</th>
                    <th className="py-2 px-2.5">Tocaste</th>
                    <th className="py-2 px-2 text-center">Desviación</th>
                    <th className="py-2 px-2 text-center">Latencia</th>
                    <th className="py-2 px-2 text-center">Escuchas</th>
                    <th className="py-2 px-2 text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300 font-mono text-[11px]">
                  {questions.map((q) => (
                    <tr key={q.questionIndex} className="hover:bg-zinc-900/40">
                      <td className="py-1.5 px-2.5 text-zinc-500 font-bold">{q.questionIndex}</td>
                      <td className="py-1.5 px-2.5 text-sky-300 font-bold">
                        {q.expectedName} ({q.expectedNote})
                      </td>
                      <td className="py-1.5 px-2.5 text-zinc-200 font-semibold">
                        {q.playedName} ({q.playedNote})
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span
                          className={
                            q.semitoneDistance === 0
                              ? 'text-zinc-500'
                              : q.semitoneDistance > 0
                                ? 'text-purple-400 font-bold'
                                : 'text-amber-400 font-bold'
                          }
                        >
                          {q.semitoneDistance === 0
                            ? '0 st'
                            : `${q.semitoneDistance > 0 ? `+${q.semitoneDistance}` : q.semitoneDistance} st`}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold">
                        {(q.responseTimeMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span
                          className="text-zinc-400"
                          title={`Escuchas previas: ${q.preAnswerListens} | Re-escuchas post-error: ${q.postErrorListens}`}
                        >
                          {q.preAnswerListens > 1 ? `🎧x${q.preAnswerListens}` : '1x'}
                          {q.postErrorListens > 0 ? ` / 👂x${q.postErrorListens}` : ''}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.isCorrect
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                          }`}
                        >
                          {q.isCorrect ? 'OK' : 'FALLO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. PIE CON BOTÓN DE CIERRE */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            className="font-mono text-xs cursor-pointer"
          >
            Cerrar Inspector
          </Button>
        </div>
      </div>
    </div>
  )
}
