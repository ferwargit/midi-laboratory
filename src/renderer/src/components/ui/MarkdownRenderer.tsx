import React, { useMemo } from 'react'
import * as markdownParser from './markdownParser'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  className = ''
}: MarkdownRendererProps): React.ReactElement {
  // El parseo es O(líneas) con regex por línea: se memoriza para que renders
  // idénticos (p. ej. los disparados por el ticker de reasoningSeconds) no
  // re-tokenicen el mismo contenido. (OLA 3.2 / F5-03)
  const blocks = useMemo(() => markdownParser.parseMarkdownBlocks(content ?? ''), [content])

  if (!content || typeof content !== 'string') return <></>

  return (
    <div className={`space-y-2.5 text-sm leading-relaxed text-zinc-200 font-sans ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'header2':
            return (
              <h3
                key={idx}
                className="text-base md:text-lg font-bold text-sky-300 mt-4 mb-2 font-mono flex items-center gap-2"
              >
                <span>{markdownParser.formatInline(block.content)}</span>
              </h3>
            )

          case 'header3':
            return (
              <h4
                key={idx}
                className="text-sm md:text-base font-bold text-purple-300 mt-3 mb-1.5 font-mono"
              >
                {markdownParser.formatInline(block.content)}
              </h4>
            )

          case 'header4':
            return (
              <h5
                key={idx}
                className="text-xs md:text-sm font-bold text-zinc-100 mt-2 mb-1 font-mono uppercase tracking-wider"
              >
                {markdownParser.formatInline(block.content)}
              </h5>
            )

          case 'divider':
            return <hr key={idx} className="border-zinc-800/80 my-3" />

          case 'quote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-purple-500 bg-purple-950/20 rounded-r-xl p-3 text-xs text-zinc-300 italic my-2"
              >
                {markdownParser.formatInline(block.content)}
              </blockquote>
            )

          case 'code':
            return (
              <div
                key={idx}
                className="my-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-sky-300 overflow-x-auto shadow-inner"
              >
                <pre className="m-0 whitespace-pre">{block.content}</pre>
              </div>
            )

          case 'list':
            return (
              <div key={idx} className="space-y-1 my-1.5 pl-1">
                {block.lines?.map((line, lIdx) => {
                  const isNumbered = /^\d+\.\s/.test(line)
                  const cleanText = line.replace(/^(\*|-|\d+\.)\s+/, '')
                  const numberMatch = line.match(/^(\d+)\./)

                  return (
                    <div key={lIdx} className="flex items-start gap-2.5">
                      {isNumbered ? (
                        <span className="font-mono text-purple-400 font-bold text-xs shrink-0 mt-0.5 w-4 text-right">
                          {numberMatch ? numberMatch[1] : lIdx + 1}.
                        </span>
                      ) : (
                        <span className="text-purple-400 text-xs shrink-0 mt-1">●</span>
                      )}
                      <span className="text-zinc-300 text-sm leading-normal">
                        {markdownParser.formatInline(cleanText)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )

          case 'table':
            return <MarkdownTable key={idx} lines={block.lines || []} />

          case 'paragraph':
          default:
            return (
              <p key={idx} className="m-0 text-zinc-300 text-sm leading-relaxed">
                {markdownParser.formatInline(block.content)}
              </p>
            )
        }
      })}
    </div>
  )
})

// -------------------------------------------------------------
// COMPONENTE DE TABLA MARKDOWN CON ESTILOS STUDIO
// -------------------------------------------------------------
function MarkdownTable({ lines }: { lines: string[] }): React.ReactElement {
  if (lines.length < 2) return <></>

  const headerCells = markdownParser.splitTableRow(lines[0])
  // La fila 1 suele ser el separador |---|---|
  const dataRows = lines.slice(2).map(markdownParser.splitTableRow)

  return (
    <div className="overflow-x-auto my-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/90 shadow-xl">
      <table className="w-full text-left text-xs font-sans">
        <thead className="bg-zinc-900/90 border-b border-zinc-800 text-purple-300 font-mono font-bold uppercase text-[11px]">
          <tr>
            {headerCells.map((cell, idx) => (
              <th key={idx} className="py-2.5 px-3.5 whitespace-nowrap">
                {markdownParser.formatInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 text-zinc-300 font-sans">
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-zinc-900/40 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2.5 px-3.5 leading-normal">
                  {markdownParser.formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
