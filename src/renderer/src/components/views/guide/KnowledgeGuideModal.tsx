import React, { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { IrtCurveDiagram } from './IrtCurveDiagram'
import { LatencySpectrumDiagram } from './LatencySpectrumDiagram'
import { EntropyScaleDiagram } from './EntropyScaleDiagram'
import { LeitnerBoxDiagram } from './LeitnerBoxDiagram'
import { PitchBiasDiagram } from './PitchBiasDiagram'

interface KnowledgeGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTopic = 'irt' | 'latency' | 'entropy' | 'leitner' | 'bias'

export function KnowledgeGuideModal({
  isOpen,
  onClose
}: KnowledgeGuideModalProps): React.ReactElement | null {
  const [activeTopic, setActiveTopic] = useState<GuideTopic>('irt')

  if (!isOpen) return null

  const topics: Array<{ id: GuideTopic; label: string; icon: string }> = [
    { id: 'irt', label: 'Curva IRT (Azar)', icon: '📈' },
    { id: 'latency', label: 'Latencia & Fatiga', icon: '⚡' },
    { id: 'entropy', label: 'Entropía (Shannon)', icon: '🧠' },
    { id: 'leitner', label: 'Cajas de Leitner', icon: '🔁' },
    { id: 'bias', label: 'Sesgo (+st / -st)', icon: '🎯' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-4xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-sans">
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-700/60 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              📖
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 m-0">
                Centro de Conocimiento Psicoacústico & Metacognición
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Diagramas interactivos de los modelos cognitivos y matemáticos que rigen el
                software:
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg font-mono p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Pestañas de Temas */}
        <div className="flex gap-1.5 border-b border-zinc-800/80 pb-2 overflow-x-auto font-mono text-xs select-none">
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(): void => setActiveTopic(t.id)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTopic === t.id
                  ? 'bg-sky-600 text-white font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Renderizado del Diagrama Activo */}
        <div className="pt-1">
          {activeTopic === 'irt' && <IrtCurveDiagram />}
          {activeTopic === 'latency' && <LatencySpectrumDiagram />}
          {activeTopic === 'entropy' && <EntropyScaleDiagram />}
          {activeTopic === 'leitner' && <LeitnerBoxDiagram />}
          {activeTopic === 'bias' && <PitchBiasDiagram />}
        </div>

        {/* Pie con botón de cierre */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <Button variant="secondary" size="md" onClick={onClose} className="font-mono text-xs">
            Cerrar Guía
          </Button>
        </div>
      </div>
    </div>
  )
}
