import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({
  content,
  className = ''
}: MarkdownRendererProps): React.ReactElement {
  if (!content) return <></>

  // Divide el texto en párrafos y bloques
  const lines = content.split('\n')

  return (
    <div className={`space-y-2 text-sm leading-relaxed text-zinc-200 font-sans ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()

        // Línea divisoria ---
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="border-zinc-800 my-3" />
        }

        // Título H3 / H4 (### o ####)
        if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
          const titleText = trimmed.replace(/^#{3,4}\s+/, '')
          return (
            <h4
              key={idx}
              className="text-sm md:text-base font-bold text-purple-300 mt-3 mb-1 font-mono"
            >
              {formatInlineFormatting(titleText)}
            </h4>
          )
        }

        // Título H2 (##)
        if (trimmed.startsWith('## ')) {
          const titleText = trimmed.replace(/^##\s+/, '')
          return (
            <h3
              key={idx}
              className="text-base md:text-lg font-bold text-sky-300 mt-4 mb-1.5 font-mono"
            >
              {formatInlineFormatting(titleText)}
            </h3>
          )
        }

        // Líneas vacías
        if (trimmed.length === 0) {
          return <div key={idx} className="h-1" />
        }

        // Elementos de lista (* o -)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const itemText = trimmed.substring(2)
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-purple-400 mt-1 shrink-0 text-xs">●</span>
              <span>{formatInlineFormatting(itemText)}</span>
            </div>
          )
        }

        // Párrafo normal
        return (
          <p key={idx} className="m-0">
            {formatInlineFormatting(line)}
          </p>
        )
      })}
    </div>
  )
}

// Función auxiliar para procesar negritas (**texto**)
function formatInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-zinc-100 font-bold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}
