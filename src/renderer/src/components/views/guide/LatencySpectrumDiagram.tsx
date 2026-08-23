import React from 'react'
import { COGNITIVE_LATENCY_THRESHOLDS } from '../../../domain/analytics/historyAnalytics'

export function LatencySpectrumDiagram(): React.ReactElement {
  return (
    <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 space-y-3 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-emerald-400">
          ⚡ ESPECTRO DE LATENCIA COGNITIVA & FATIGA
        </span>
        <span className="text-[10px] text-zinc-500">Tiempo de acceso a la memoria auditiva</span>
      </div>

      {/* Barra continua de 3 zonas */}
      <div className="space-y-2 pt-2">
        <div className="w-full h-8 rounded-xl overflow-hidden flex text-[10px] font-bold select-none shadow-inner border border-zinc-800">
          <div className="w-[35%] bg-gradient-to-r from-emerald-600 to-emerald-500 text-zinc-950 flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span>⚡ REFLEJO INMEDIATO</span>
          </div>
          <div className="w-[40%] bg-gradient-to-r from-amber-600 to-amber-500 text-zinc-950 flex items-center justify-center gap-1">
            <span>🤔 DEDUCCIÓN ACTIVA</span>
          </div>
          <div className="w-[25%] bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-center gap-1">
            <span>⏳ FATIGA / DUDA</span>
          </div>
        </div>

        {/* Marcadores de tiempo calibrados */}
        <div className="flex justify-between text-[10px] text-zinc-400 px-1 font-mono">
          <span>0.0s</span>
          <span>1.4s (Umbral de Reflejo)</span>
          <span>2.8s (Umbral de Fatiga)</span>
          <span>5.0s+</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-sans text-zinc-300">
        <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-emerald-800/40 space-y-1">
          <strong className="text-emerald-400 block font-mono text-[10px] uppercase">
            Zona 1 ({COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL})
          </strong>
          <span>
            Acceso instantáneo a la imagen mental interna del tono. La nota está totalmente
            consolidada.
          </span>
        </div>
        <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-amber-800/40 space-y-1">
          <strong className="text-amber-400 block font-mono text-[10px] uppercase">
            Zona 2 ({COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL})
          </strong>
          <span>El cerebro realiza cálculo interválico por descarte antes de pulsar la tecla.</span>
        </div>
        <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-rose-800/40 space-y-1">
          <strong className="text-rose-400 block font-mono text-[10px] uppercase">
            Zona 3 ({COGNITIVE_LATENCY_THRESHOLDS.SLOW_LABEL})
          </strong>
          <span>
            Búsqueda al azar o fatiga auditiva: el oído se satura de armónicos y pierde
            discriminación rápida.
          </span>
        </div>
      </div>
    </div>
  )
}
