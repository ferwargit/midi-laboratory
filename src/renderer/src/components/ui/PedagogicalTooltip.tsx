import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { getConcept } from '../../domain/analytics/pedagogicalDictionary'
import {
  TOOLTIP_WIDTH,
  ESTIMATED_TOOLTIP_HEIGHT,
  computeTooltipPlacement,
  type TooltipPlacement
} from './tooltipPlacement'

const TOOLTIP_ID = 'pedagogical-tooltip'

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
  const [coords, setCoords] = useState<TooltipPlacement>({
    top: 0,
    left: 0,
    placeBelow: false
  })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const concept = getConcept(conceptId)

  const updatePosition = (): void => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? ESTIMATED_TOOLTIP_HEIGHT

    setCoords(
      computeTooltipPlacement(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
        tooltipHeight
      )
    )
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

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Space: suprime el scroll nativo de la página (patrón WAI-ARIA button)
      e.preventDefault()
      updatePosition()
      setIsVisible((prev) => !prev)
    }
  }

  useEffect(() => {
    if (!isVisible) return
    const handleScrollOrResize = (): void => updatePosition()
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsVisible(false)
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('keydown', handleKeyDown)
    return (): void => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible])

  // Nada de abajo depende de `isVisible`, así que este layout effect puede
  // re-posicionar con la altura real del portal recién montado, antes de pintar.
  useLayoutEffect(() => {
    if (!isVisible) return
    updatePosition()
  }, [isVisible])

  if (!concept) {
    return <span className={className}>{children}</span>
  }

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-expanded={isVisible}
        aria-controls={isVisible ? TOOLTIP_ID : undefined}
        className={`inline-flex items-center cursor-help group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={handleTriggerKeyDown}
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
            id={TOOLTIP_ID}
            ref={tooltipRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${TOOLTIP_WIDTH}px`,
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
