import React from 'react'

export function IrtCurveDiagram(): React.ReactElement {
  return (
    <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 space-y-3 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-sky-400">📈 CURVA IRT: DESCUENTO DEL FACTOR SUERTE</span>
        <span className="text-[10px] text-zinc-500">Fórmula: (Acierto - c) / (1 - c)</span>
      </div>

      <div className="h-44 w-full relative pt-2">
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 500 120"
          preserveAspectRatio="none"
        >
          {/* Ejes */}
          <line x1="40" y1="10" x2="40" y2="105" stroke="#3f3f46" strokeWidth="1" />
          <line x1="40" y1="105" x2="490" y2="105" stroke="#3f3f46" strokeWidth="1" />

          {/* Línea de Azar puro (Chance baseline) */}
          <path
            d="M 50 45 Q 200 70 480 100"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Curva de Oído Real Normalizado */}
          <path d="M 50 85 Q 250 40 480 20" fill="none" stroke="#10b981" strokeWidth="3" />

          {/* Marcadores */}
          <circle cx="90" cy="48" r="4" fill="#f59e0b" />
          <text x="95" y="44" fill="#f59e0b" fontSize="9">
            3 notas: Azar 33%
          </text>

          <circle cx="250" cy="78" r="4" fill="#f59e0b" />
          <text x="255" y="74" fill="#f59e0b" fontSize="9">
            8 notas: Azar 12.5%
          </text>

          <circle cx="450" cy="98" r="4" fill="#f59e0b" />
          <text x="360" y="115" fill="#f59e0b" fontSize="9">
            13 notas: Azar 7.7%
          </text>

          <circle cx="450" cy="22" r="4" fill="#10b981" />
          <text x="320" y="18" fill="#10b981" fontSize="9" fontWeight="bold">
            Oído Real (Alta Fidelidad)
          </text>
        </svg>
      </div>

      <p className="text-xs text-zinc-300 font-sans leading-relaxed m-0">
        💡 <strong>Principio Psicoacústico:</strong> Con pools pequeños (3 notas), hasta 1 de cada 3
        aciertos puede deberse al azar estadístico. A medida que amplías la escala hacia 13 notas,
        la probabilidad de suerte cae por debajo del 8% y tu acierto refleja 100% oído real.
      </p>
    </div>
  )
}
