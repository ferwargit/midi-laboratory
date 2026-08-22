import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getConcept } from '../../domain/analytics/pedagogicalDictionary'

interface PedagogicalTooltipProps {
  conceptId: string
  children: React.ReactNode
  className?: string
}

export function PedagogicalTooltip({
  conceptId,
  children,
  className = ''
}: PedagogicalTooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placeBelow: boolean }>({
    top: 0,
    left: 0,
    placeBelow: false
  })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const concept = getConcept(conceptId)

  const updatePosition = (): void => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipWidth = 320

    // Si está cerca del borde superior (<260px), se despliega hacia abajo; si no, hacia arriba
    const placeBelow = rect.top < 260
    const top = placeBelow ? rect.bottom + 8 : rect.top - 8

    // Centrado horizontal seguro dentro de los límites de la ventana
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    if (typeof window !== 'undefined') {
      left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left))
    }

    setCoords({ top, left, placeBelow })
  }

  const handleMouseEnter = (): void => {
    updatePosition()
    setIsVisible(true)
  }

  const handleMouseLeave = (): void => {
    setIsVisible(false)
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    updatePosition()
    setIsVisible((prev) => !prev)
  }

  useEffect(() => {
    if (!isVisible) return
    const handleScrollOrResize = (): void => updatePosition()
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return (): void => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isVisible])

  if (!concept) {
    return <span className={className}>{children}</span>
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center cursor-help group ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <span className="border-b border-dotted border-zinc-500/80 group-hover:border-sky-400 transition-colors">
          {children}
        </span>
        <span className="text-[9px] font-mono text-sky-400/80 ml-0.5 select-none">ⓘ</span>
      </span>

      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: coords.placeBelow ? `${coords.top}px` : undefined,
              bottom:
                !coords.placeBelow && typeof window !== 'undefined'
                  ? `${window.innerHeight - coords.top}px`
                  : undefined,
              left: `${coords.left}px`,
              width: '320px',
              zIndex: 99999
            }}
            className="p-3.5 bg-zinc-950/95 backdrop-blur-2xl border border-sky-500/50 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] text-left font-sans animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
          >
            {/* Cabecera del Tooltip */}
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
              <span className="font-bold text-xs text-sky-300 font-mono tracking-tight">
                {concept.title}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-[8px] font-mono text-sky-300 uppercase">
                {concept.category}
              </span>
            </div>

            <div className="text-[10px] text-zinc-400 font-mono mt-0.5 leading-tight">
              {concept.subtitle}
            </div>

            {/* 1. Definición Simple */}
            <p className="text-xs text-zinc-200 mt-2 leading-relaxed font-sans m-0">
              {concept.shortDefinition}
            </p>

            {/* 2. Fórmula / Cálculo */}
            <div className="mt-2 p-1.5 bg-zinc-900/90 rounded-lg border border-zinc-800/80 font-mono text-[10px] text-purple-300">
              <span className="text-zinc-500 block text-[8px] uppercase">Cálculo:</span>
              {concept.formulaOrCalculation}
            </div>

            {/* 3. Takeaway Práctico */}
            <div className="mt-2 p-1.5 bg-emerald-950/40 rounded-lg border border-emerald-800/50 text-[11px] text-emerald-300 font-sans leading-snug">
              💡 <strong>En tu práctica:</strong> {concept.practicalTakeaway}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
