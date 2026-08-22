import React from 'react'

export function LeitnerBoxDiagram(): React.ReactElement {
  return (
    <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 space-y-3 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-sky-400">
          🔁 REPETICIÓN ESPACIADA: LAS 3 CAJAS DE LEITNER
        </span>
        <span className="text-[10px] text-zinc-500">Curva de olvido de Ebbinghaus</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Caja 1 */}
        <div className="p-3.5 bg-rose-950/30 rounded-2xl border border-rose-800/50 space-y-2">
          <div className="flex justify-between items-center">
            <strong className="text-rose-400 text-xs">📦 CAJA 1: CRÍTICA</strong>
            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[9px]">
              Turno 1
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed m-0">
            Notas falladas o nuevas. Se preguntan <strong>inmediatamente</strong> en la siguiente
            ronda (alta prioridad de peso 4.0x).
          </p>
        </div>

        {/* Caja 2 */}
        <div className="p-3.5 bg-amber-950/30 rounded-2xl border border-amber-800/50 space-y-2">
          <div className="flex justify-between items-center">
            <strong className="text-amber-400 text-xs">📦 CAJA 2: CONSOLIDACIÓN</strong>
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[9px]">
              Turno 3
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed m-0">
            Notas con 1 acierto consecutivo. Se espacian cada <strong>3 ejercicios</strong> para
            verificar retención a corto plazo (peso 1.5x).
          </p>
        </div>

        {/* Caja 3 */}
        <div className="p-3.5 bg-emerald-950/30 rounded-2xl border border-emerald-800/50 space-y-2">
          <div className="flex justify-between items-center">
            <strong className="text-emerald-400 text-xs">📦 CAJA 3: DOMINADA</strong>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[9px]">
              Turno 8
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed m-0">
            Notas con 3+ aciertos seguidos. Se espacian cada <strong>8 ejercicios</strong> para
            asegurar retención a largo plazo (peso 0.4x).
          </p>
        </div>
      </div>

      <div className="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 text-[11px] font-sans text-amber-300/90">
        ⚠️ <strong>Regla de Degeneración Inmediata:</strong> Cualquier fallo en Caja 2 o Caja 3
        devuelve inmediatamente esa nota a Caja 1 para neutralizar la interferencia perceptual.
      </div>
    </div>
  )
}
