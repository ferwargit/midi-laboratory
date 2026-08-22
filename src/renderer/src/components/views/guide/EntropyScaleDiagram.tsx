import React from 'react'

export function EntropyScaleDiagram(): React.ReactElement {
  const entropyLevels = [
    {
      pool: 3,
      bits: 1.58,
      label: 'Baja Incertidumbre',
      desc: 'Ideal para anclaje tonal inicial (C, D, E).'
    },
    { pool: 5, bits: 2.32, label: 'Carga Moderada', desc: 'Pentacordio diatónico (C4 a G4).' },
    {
      pool: 8,
      bits: 3.0,
      label: 'Carga Estándar',
      desc: 'Octava diatónica completa natural (C4 a C5).'
    },
    {
      pool: 13,
      bits: 3.7,
      label: 'Alta Incertidumbre',
      desc: 'Cromático completo (todas las 12 notas + octava).'
    }
  ]

  return (
    <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 space-y-3 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-purple-400">🧠 ENTROPÍA DE SHANNON: CARGA CONTEXTUAL</span>
        <span className="text-[10px] text-zinc-500">H = log₂(N) bits de información</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
        {entropyLevels.map((lvl) => (
          <div
            key={lvl.pool}
            className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 space-y-1.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-100">{lvl.pool} notas</span>
                <span className="text-xs font-bold text-purple-400">{lvl.bits} bits</span>
              </div>
              <span className="text-[10px] text-sky-400 block font-semibold mt-0.5">
                {lvl.label}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans leading-tight m-0">{lvl.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-300 font-sans leading-relaxed m-0 pt-1">
        💡 <strong>Principio Psicoacústico:</strong> La memoria de trabajo auditiva tiene un límite
        de retención en paralelo. A mayor entropía (superior a 3.0 bits), más difícil es identificar
        las notas por timbre y el cerebro se ve forzado a discriminar frecuencias fundamentales
        puras.
      </p>
    </div>
  )
}
