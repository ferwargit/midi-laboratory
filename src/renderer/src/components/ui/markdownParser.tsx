import React from 'react'

// Parser puro de bloques Markdown, separado del componente React para poder
// espiar sus invocaciones como proxy exacto de la actividad de parseo en las
// pruebas (mismo patrón que noteUtils.midiNoteToName en
// s3-render-performance.test.tsx). (OLA 3.2 / F5-03)

export type BlockType =
  'paragraph' | 'header2' | 'header3' | 'header4' | 'divider' | 'list' | 'table' | 'code' | 'quote'

export interface ParsedBlock {
  type: BlockType
  content: string
  lines?: string[]
}

export function splitTableRow(rowStr: string): string[] {
  return rowStr
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

// -------------------------------------------------------------
// FORMATEO EN LÍNEA: Negritas (**), Código en línea (`), Cursiva (*)
// -------------------------------------------------------------
export function formatInline(text: string): React.ReactNode {
  if (!text) return ''

  // Tokenización por negrita (**...**) y código en línea (`...`)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g)

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="text-zinc-100 font-bold">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-sky-300 font-mono text-xs mx-0.5 font-semibold"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    return token
  })
}

// -------------------------------------------------------------
// PARSER DE BLOQUES (Headers, Lists, Tables, Code)
// -------------------------------------------------------------
export function parseMarkdownBlocks(rawText: string): ParsedBlock[] {
  const lines = rawText.split('\n')
  const blocks: ParsedBlock[] = []

  let currentListLines: string[] = []
  let currentTableLines: string[] = []
  let inCodeBlock = false
  let currentCodeLines: string[] = []

  const flushList = (): void => {
    if (currentListLines.length > 0) {
      blocks.push({ type: 'list', content: '', lines: [...currentListLines] })
      currentListLines = []
    }
  }

  const flushTable = (): void => {
    if (currentTableLines.length > 0) {
      blocks.push({ type: 'table', content: '', lines: [...currentTableLines] })
      currentTableLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Manejo de Bloques de Código (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: currentCodeLines.join('\n') })
        currentCodeLines = []
        inCodeBlock = false
      } else {
        flushList()
        flushTable()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      currentCodeLines.push(line)
      continue
    }

    // Manejo de Tablas (| ... |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList()
      currentTableLines.push(trimmed)
      continue
    } else {
      flushTable()
    }

    // Manejo de Listas (*, -, 1., 2.)
    if (/^(\*|-|\d+\.)\s+/.test(trimmed)) {
      currentListLines.push(trimmed)
      continue
    } else {
      flushList()
    }

    // Líneas divisorias
    if (trimmed === '---' || trimmed === '***') {
      blocks.push({ type: 'divider', content: '' })
      continue
    }

    // Citas (> )
    if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', content: trimmed.substring(2) })
      continue
    }

    // Encabezados
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'header2', content: trimmed.substring(3) })
      continue
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'header3', content: trimmed.substring(4) })
      continue
    }
    if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'header4', content: trimmed.substring(5) })
      continue
    }

    // Párrafos regulares no vacíos
    if (trimmed.length > 0) {
      blocks.push({ type: 'paragraph', content: line })
    }
  }

  flushList()
  flushTable()

  return blocks
}
