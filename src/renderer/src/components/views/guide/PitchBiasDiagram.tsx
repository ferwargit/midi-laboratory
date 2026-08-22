import React from 'react'

export function PitchBiasDiagram(): React.ReactElement {
  return (
    <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 space-y-3 font-mono">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-amber-400">
          🎯 POLARIDAD DEL SESGO DE SEMITONO (+st vs -st)
        </span>
        <span className="text-[10px] text-zinc-500">Desviación direccional del error</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="p-3.5 bg-purple-950/30 rounded-2xl border border-purple-800/50 space-y-2">
          <div className="flex justify-between items-center">
            <strong className="text-purple-300 text-xs">▲ SESGO HACIA LO AGUDO (+st)</strong>
            <span className="text-[9px] text-purple-400 font-bold">Nota más alta</span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed m-0">
            Ocurre cuando percibes la nota por encima de su tono real (ej: suena C4 y tocas C#4 o
            D4). Indica anticipación de tensión armónica hacia frecuencias agudas.
          </p>
        </div>

        <div className="p-3.5 bg-amber-950/30 rounded-2xl border border-amber-800/50 space-y-2">
          <div className="flex justify-between items-center">
            <strong className="text-amber-300 text-xs">▼ SESGO HACIA LO GRAVE (-st)</strong>
            <span className="text-[9px] text-amber-400 font-bold">Nota más baja</span>
          </div>
          <p className="text-[11px] text-zinc-300 font-sans leading-relaxed m-0">
            Ocurre cuando percibes la nota por debajo de su tono real (ej: suena E4 y tocas D#4 o
            D4). Típico cuando el oído busca estabilidad y resolución en la tónica inferior.
          </p>
        </div>
      </div>

      <p className="text-xs text-zinc-300 font-sans leading-relaxed m-0">
        💡 <strong>Uso en la IA Local:</strong> Qwen analiza si tu sesgo es simétrico o asimétrico
        para prescribir pares de tonos que equilibren la tensión auditiva en tu registro central.
      </p>
    </div>
  )
}
