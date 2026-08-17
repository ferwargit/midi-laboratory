import React, { useRef, useEffect, useState } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { EXERCISE_PRESETS } from './domain/music/presets'
import { AVAILABLE_STRATEGIES } from './domain/adaptation/adaptiveEngine'
import { INSTRUMENT_CATALOG } from './domain/music/instruments'
import { getIntervalDefinition } from './domain/music/intervals'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { Card } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { StatCard } from './components/ui/StatCard'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { Header } from './components/trainer/Header'
import { MidiDeviceSelect } from './components/trainer/MidiDeviceSelect'
import { PianoKeyboard } from './components/trainer/PianoKeyboard'
import { FeedbackPanel } from './components/trainer/FeedbackPanel'
import { IntervalFeedbackPanel } from './components/trainer/IntervalFeedbackPanel'
import { IntervalSummaryCard } from './components/trainer/IntervalSummaryCard'
import { MidiMonitor } from './components/trainer/MidiMonitor'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

type AppMode = 'single_note' | 'intervals'

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false)
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    enableSoftwareThru: true
  })

  // 1. Modalidad Nota Individual
  const singleNoteTrainer = useSingleNoteTrainer({
    onPlayStimulus: (note, decision) => {
      midi.sendNote(note)
      const noteName = midiNoteToName(note)
      midi.addLog({
        type: 'OUT',
        message: `🎵 Estímulo (${singleNoteTrainer.selectedInstrument.name}) -> ${noteName} (${note})`
      })
      midi.addLog({
        type: 'AI',
        message: `🧠 Decisión IA: ${decision.reason} | Pesos: ${Object.entries(
          decision.weightsSnapshot
        )
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')}`
      })
    },
    onInstrumentChanged: (programNumber) => {
      midi.changeProgram(programNumber)
      midi.addLog({
        type: 'OUT',
        message: `🎛️ Cambio de Timbre MIDI Program Change -> ${programNumber}`
      })
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // 2. Modalidad Intervalos
  const intervalTrainer = useIntervalTrainer({
    onPlayInterval: (root, target) => {
      midi.sendNote(root, 500)
      const rootName = midiNoteToName(root)
      const targetName = midiNoteToName(target)
      midi.addLog({
        type: 'OUT',
        message: `📏 Intervalo Nota 1 -> ${rootName} (${root})`
      })

      setTimeout(() => {
        midi.sendNote(target, 600)
        midi.addLog({
          type: 'OUT',
          message: `📏 Intervalo Nota 2 -> ${targetName} (${target})`
        })
      }, 550)
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  useEffect(() => {
    if (appMode === 'single_note') {
      handleNoteRef.current = singleNoteTrainer.handleUserNotePlayed
    } else {
      handleNoteRef.current = intervalTrainer.handleUserNotePlayed
    }
  }, [appMode, singleNoteTrainer.handleUserNotePlayed, intervalTrainer.handleUserNotePlayed])

  const isAnySessionActive = singleNoteTrainer.isSessionActive || intervalTrainer.isSessionActive

  const weakNotesList = Array.from(singleNoteTrainer.performances.values())
    .filter((p) => p.attempts > 0 && p.accuracyPercentage < 85)
    .map((p) => ({
      name: midiNoteToName(p.noteNumber),
      accuracy: p.accuracyPercentage,
      attempts: p.attempts
    }))

  const handleConfirmReset = (): void => {
    singleNoteTrainer.clearDatabaseHistory()
    setIsResetModalOpen(false)
  }

  const combinedSummary = {
    totalSessions:
      singleNoteTrainer.dbSummary.totalSessions + intervalTrainer.dbSummary.totalSessions,
    totalExercises:
      singleNoteTrainer.dbSummary.totalExercises + intervalTrainer.dbSummary.totalExercises,
    overallAccuracy:
      singleNoteTrainer.dbSummary.totalSessions > 0 || intervalTrainer.dbSummary.totalSessions > 0
        ? Math.round(
            (singleNoteTrainer.dbSummary.overallAccuracy *
              singleNoteTrainer.dbSummary.totalSessions +
              intervalTrainer.dbSummary.overallAccuracy * intervalTrainer.dbSummary.totalSessions) /
              Math.max(
                1,
                singleNoteTrainer.dbSummary.totalSessions + intervalTrainer.dbSummary.totalSessions
              )
          )
        : 0,
    overallAvgTimeMs:
      singleNoteTrainer.dbSummary.totalSessions > 0 || intervalTrainer.dbSummary.totalSessions > 0
        ? Math.round(
            (singleNoteTrainer.dbSummary.overallAvgTimeMs *
              singleNoteTrainer.dbSummary.totalSessions +
              intervalTrainer.dbSummary.overallAvgTimeMs *
                intervalTrainer.dbSummary.totalSessions) /
              Math.max(
                1,
                singleNoteTrainer.dbSummary.totalSessions + intervalTrainer.dbSummary.totalSessions
              )
          )
        : 0
  }

  // Teclas activas/fijadas en intervalos
  const liveIntervalActiveNotes = intervalTrainer.isSessionActive
    ? intervalTrainer.firstNotePlayed !== null
      ? [intervalTrainer.firstNotePlayed]
      : intervalTrainer.rootRangeNotes
    : intervalTrainer.rootRangeNotes

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <Header status={midi.status} />

      {/* SELECTOR DE MODALIDAD */}
      <div className="flex gap-2 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-lg">
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('single_note')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'single_note'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          🎵 Modalidad 1: Nota Individual
        </button>
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('intervals')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'intervals'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          📏 Modalidad 2: Intervalos (2 Notas)
        </button>
      </div>

      <MidiDeviceSelect
        inputs={midi.inputs}
        outputs={midi.outputs}
        selectedInputId={midi.selectedInputId}
        selectedOutputId={midi.selectedOutputId}
        onSelectInput={midi.setSelectedInputId}
        onSelectOutput={midi.setSelectedOutputId}
        disabled={isAnySessionActive}
      />

      {/* ========================================================= */}
      {/* VISTA 1: NOTA INDIVIDUAL                                  */}
      {/* ========================================================= */}
      {appMode === 'single_note' && (
        <>
          {singleNoteTrainer.isSessionFinished ? (
            <Card className="border-sky-500/40 bg-zinc-900/90">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-sky-400 m-0">🎉 ¡Sesión Finalizada!</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Diagnóstico guardado en base de datos (
                    {singleNoteTrainer.selectedInstrument.name}):
                  </p>
                </div>
                <div className="flex gap-2">
                  {weakNotesList.length >= 2 && (
                    <Button variant="danger" onClick={singleNoteTrainer.trainWeakNotesOnly}>
                      🎯 Entrenar Solo Notas Débiles ({weakNotesList.length})
                    </Button>
                  )}
                  <Button variant="primary" onClick={singleNoteTrainer.startSession}>
                    🔄 Repetir Misma Sesión
                  </Button>
                  <Button variant="secondary" onClick={singleNoteTrainer.resetToConfig}>
                    ⚙️ Configurar Otra Sesión
                  </Button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <PianoKeyboard
                  keys={PIANO_KEYS}
                  activeNotes={singleNoteTrainer.activeNotes}
                  pressedNotes={midi.pressedNotes}
                  onToggleNote={() => {}}
                  performances={singleNoteTrainer.performances}
                  showHeatmap={true}
                  disabled={true}
                />
              </div>

              {weakNotesList.length > 0 ? (
                <div className="bg-zinc-950 p-3 rounded border border-red-900/40 text-xs">
                  <strong className="text-red-400 block mb-1">
                    Notas prioritarias a reforzar:
                  </strong>
                  <div className="flex flex-wrap gap-2">
                    {weakNotesList.map((item) => (
                      <span
                        key={item.name}
                        className="bg-red-950/60 border border-red-800 text-red-300 px-2 py-0.5 rounded"
                      >
                        {item.name}: {item.accuracy}% acierto ({item.attempts} intentos)
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded text-xs text-emerald-300">
                  🌟 ¡Excelente rendimiento! Todas las notas fueron reconocidas con alta precisión
                  (&gt;85%).
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 m-0">
                    {singleNoteTrainer.isSessionActive
                      ? `Pregunta ${singleNoteTrainer.currentQuestionIndex} / ${
                          singleNoteTrainer.sessionLength === -1
                            ? '🎯 Modo Maestría'
                            : singleNoteTrainer.sessionLength === 0
                              ? '∞'
                              : singleNoteTrainer.sessionLength
                        }`
                      : 'Configuración: Reconocimiento de Notas'}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Timbre:{' '}
                    <strong className="text-emerald-400">
                      {singleNoteTrainer.selectedInstrument.name}
                    </strong>{' '}
                    | Motor:{' '}
                    <strong className="text-sky-400">
                      {
                        AVAILABLE_STRATEGIES.find(
                          (s) => s.id === singleNoteTrainer.selectedStrategyId
                        )?.name
                      }
                    </strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!singleNoteTrainer.isSessionActive ? (
                    <Button variant="success" onClick={singleNoteTrainer.startSession}>
                      ▶ Comenzar Sesión
                    </Button>
                  ) : (
                    <>
                      <Button variant="primary" onClick={singleNoteTrainer.repeatCurrentNote}>
                        🔊 Repetir Nota
                      </Button>
                      <Button variant="danger" onClick={singleNoteTrainer.stopSession}>
                        ⏹ Detener y Guardar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {singleNoteTrainer.isSessionActive && (
                <FeedbackPanel
                  isWaitingAnswer={singleNoteTrainer.isWaitingAnswer}
                  lastResult={singleNoteTrainer.lastResult}
                />
              )}

              {singleNoteTrainer.isSessionActive && (
                <div className="space-y-1.5 mb-3">
                  <PianoKeyboard
                    keys={PIANO_KEYS}
                    activeNotes={singleNoteTrainer.activeNotes}
                    pressedNotes={midi.pressedNotes}
                    onToggleNote={() => {}}
                    performances={singleNoteTrainer.performances}
                    showHeatmap={true}
                    disabled={true}
                  />
                </div>
              )}

              {!singleNoteTrainer.isSessionActive && (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5">Presets Rápidos:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {EXERCISE_PRESETS.map((p) => (
                        <Button
                          key={p.id}
                          size="sm"
                          variant="secondary"
                          onClick={(): void => singleNoteTrainer.setActiveNotes(p.notes)}
                        >
                          {p.name}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(): void => singleNoteTrainer.setActiveNotes([])}
                      >
                        Limpiar Todo
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5">
                      Selección Libre de Teclas (C3 a C6 - {singleNoteTrainer.activeNotes.length}{' '}
                      notas seleccionadas):
                    </div>
                    <PianoKeyboard
                      keys={PIANO_KEYS}
                      activeNotes={singleNoteTrainer.activeNotes}
                      pressedNotes={midi.pressedNotes}
                      onToggleNote={singleNoteTrainer.toggleNote}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Timbre / Instrumento:
                      </label>
                      <select
                        value={singleNoteTrainer.selectedInstrument.id}
                        onChange={(e): void =>
                          singleNoteTrainer.setSelectedInstrumentId(e.target.value)
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        {INSTRUMENT_CATALOG.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Motor de Adaptabilidad:
                      </label>
                      <select
                        value={singleNoteTrainer.selectedStrategyId}
                        onChange={(e): void =>
                          singleNoteTrainer.setSelectedStrategyId(
                            e.target.value as 'random' | 'adaptive_v1'
                          )
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        {AVAILABLE_STRATEGIES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Criterio de Sesión:
                      </label>
                      <select
                        value={singleNoteTrainer.sessionLength}
                        onChange={(e): void =>
                          singleNoteTrainer.setSessionLength(Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value={5}>5 ejercicios</option>
                        <option value={10}>10 ejercicios</option>
                        <option value={20}>20 ejercicios</option>
                        <option value={-1}>🎯 Modo Maestría (Hasta dominar en verde)</option>
                        <option value={0}>∞ Práctica Libre</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ESTADÍSTICAS NOTA INDIVIDUAL */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard title="Respuestas (Sesión)" value={singleNoteTrainer.stats.totalAnswers} />
            <StatCard
              title="Precisión"
              value={`${singleNoteTrainer.stats.accuracyPercentage}%`}
              highlightColor={
                singleNoteTrainer.stats.accuracyPercentage >= 80
                  ? 'text-emerald-400'
                  : singleNoteTrainer.stats.accuracyPercentage >= 50
                    ? 'text-amber-400'
                    : 'text-red-400'
              }
            />
            <StatCard
              title="Aciertos / Fallos"
              value={`${singleNoteTrainer.stats.correctAnswers} / ${singleNoteTrainer.stats.totalAnswers - singleNoteTrainer.stats.correctAnswers}`}
            />
            <StatCard
              title="Tiempo Medio"
              value={`${(singleNoteTrainer.stats.avgResponseTimeMs / 1000).toFixed(2)}s`}
            />
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: INTERVALOS (2 NOTAS)                             */}
      {/* ========================================================= */}
      {appMode === 'intervals' && (
        <>
          {intervalTrainer.isSessionFinished ? (
            <IntervalSummaryCard
              history={intervalTrainer.sessionHistory}
              onRepeatSession={intervalTrainer.startSession}
              onTrainWeakOnly={intervalTrainer.trainWeakIntervalsOnly}
              onResetToConfig={intervalTrainer.resetToConfig}
            />
          ) : (
            <Card>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 m-0">
                    {intervalTrainer.isSessionActive
                      ? `Pregunta ${intervalTrainer.currentQuestionIndex} / ${intervalTrainer.sessionLength === 0 ? '∞' : intervalTrainer.sessionLength}`
                      : 'Configuración: Reconocimiento de Intervalos'}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Intervalos activos:{' '}
                    <strong className="text-sky-400">
                      {intervalTrainer.activeIntervals.length}
                    </strong>{' '}
                    | Dirección:{' '}
                    <strong className="text-emerald-400">
                      {intervalTrainer.directionMode === 'ascending'
                        ? '⬆️ Ascendente'
                        : intervalTrainer.directionMode === 'descending'
                          ? '⬇️ Descendente'
                          : '🔀 Mixta'}
                    </strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!intervalTrainer.isSessionActive ? (
                    <Button variant="success" onClick={intervalTrainer.startSession}>
                      ▶ Comenzar Sesión de Intervalos
                    </Button>
                  ) : (
                    <>
                      <Button variant="primary" onClick={intervalTrainer.repeatCurrentInterval}>
                        🔊 Repetir Intervalo
                      </Button>
                      <Button variant="danger" onClick={intervalTrainer.stopSession}>
                        ⏹ Detener y Guardar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <IntervalFeedbackPanel
                isSessionActive={intervalTrainer.isSessionActive}
                stimulus={intervalTrainer.currentStimulus}
                waitingNoteStep={intervalTrainer.waitingNoteStep}
                firstNotePlayed={intervalTrainer.firstNotePlayed}
                lastResult={intervalTrainer.lastResult}
              />

              {/* TECLADO EN VIVO DURANTE INTERVALOS (CON FEEDBACK VISUAL INSTANTÁNEO) */}
              {intervalTrainer.isSessionActive && (
                <div className="space-y-1.5 mb-3">
                  <div className="text-xs text-zinc-400 font-medium">
                    {intervalTrainer.waitingNoteStep === 1
                      ? '🎹 Rango de partida activo (Tocá la primera nota):'
                      : `🎹 1ª Nota (${midiNoteToName(intervalTrainer.firstNotePlayed!)}) fijada. Tocá la 2ª nota en el piano:`}
                  </div>
                  <PianoKeyboard
                    keys={PIANO_KEYS}
                    activeNotes={liveIntervalActiveNotes}
                    pressedNotes={midi.pressedNotes}
                    onToggleNote={() => {}}
                    disabled={true}
                  />
                </div>
              )}

              {!intervalTrainer.isSessionActive && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5">Presets Pedagógicos:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {intervalTrainer.presets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={(): void => intervalTrainer.setSelectedPresetId(preset.id)}
                          className={`text-left p-2 rounded-lg border transition-colors cursor-pointer flex justify-between items-center ${
                            intervalTrainer.selectedPresetId === preset.id
                              ? 'bg-sky-950/60 border-sky-600 text-white'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-xs">{preset.name}</div>
                            <div className="text-[10px] text-zinc-400">{preset.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5">
                      Selección Libre de Intervalos ({intervalTrainer.activeIntervals.length}{' '}
                      activos):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((semitone) => {
                        const active = intervalTrainer.activeIntervals.includes(semitone)
                        const def = getIntervalDefinition(semitone)
                        return (
                          <button
                            key={semitone}
                            type="button"
                            onClick={(): void => intervalTrainer.toggleInterval(semitone)}
                            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer border ${
                              active
                                ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                            }`}
                            title={`${def.fullName} (${semitone} semitonos)`}
                          >
                            {def.shortName} ({semitone}st)
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 mb-1.5">
                      Rango de Notas Base de Partida ({intervalTrainer.rootRangeNotes.length} notas
                      seleccionadas):
                    </div>
                    <PianoKeyboard
                      keys={PIANO_KEYS}
                      activeNotes={intervalTrainer.rootRangeNotes}
                      pressedNotes={midi.pressedNotes}
                      onToggleNote={intervalTrainer.toggleRootNote}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Dirección del Intervalo:
                      </label>
                      <select
                        value={intervalTrainer.directionMode}
                        onChange={(e): void =>
                          intervalTrainer.setDirectionMode(
                            e.target.value as 'ascending' | 'descending' | 'both'
                          )
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value="ascending">⬆️ Solo Ascendente (Grave → Aguda)</option>
                        <option value="descending">⬇️ Solo Descendente (Aguda → Grave)</option>
                        <option value="both">🔀 Mixta (Ascendente y Descendente al azar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Preguntas por sesión:
                      </label>
                      <select
                        value={intervalTrainer.sessionLength}
                        onChange={(e): void =>
                          intervalTrainer.setSessionLength(Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value={5}>5 ejercicios</option>
                        <option value={10}>10 ejercicios</option>
                        <option value={20}>20 ejercicios</option>
                        <option value={0}>∞ Práctica Libre</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* HISTORIAL ACUMULADO PERSISTENTE COMBINADO */}
      <Card className="bg-zinc-900/60 border-zinc-800/80">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-400 font-medium">
            💾 Memoria a Largo Plazo (Base de Datos Local Persistente):
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
            onClick={(): void => setIsResetModalOpen(true)}
          >
            🗑️ Resetear Datos de Prueba
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
            <span className="text-zinc-500 block text-[10px]">Sesiones Totales</span>
            <strong className="text-sm text-zinc-200">{combinedSummary.totalSessions}</strong>
          </div>
          <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
            <span className="text-zinc-500 block text-[10px]">Total Ejercicios</span>
            <strong className="text-sm text-zinc-200">{combinedSummary.totalExercises}</strong>
          </div>
          <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
            <span className="text-zinc-500 block text-[10px]">Precisión Global</span>
            <strong className="text-sm text-sky-400">{combinedSummary.overallAccuracy}%</strong>
          </div>
          <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
            <span className="text-zinc-500 block text-[10px]">Tiempo Promedio</span>
            <strong className="text-sm text-zinc-200">
              {(combinedSummary.overallAvgTimeMs / 1000).toFixed(2)}s
            </strong>
          </div>
        </div>
      </Card>

      {/* MODAL DE RESET */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="¿Resetear Base de Datos de Prueba?"
        message="Esta acción eliminará todas las sesiones y respuestas acumuladas en la memoria local para que puedas reiniciar tu historial desde cero. Esta operación no se puede deshacer."
        confirmText="🗑️ Sí, Borrar Todo"
        cancelText="Cancelar"
        onConfirm={handleConfirmReset}
        onCancel={(): void => setIsResetModalOpen(false)}
      />

      <MidiMonitor logs={midi.logs} />
    </div>
  )
}
