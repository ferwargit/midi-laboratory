## Context

La iconografía actual utiliza emojis Unicode (🎹, 👂, 👁️, 📥, 📤, 🗑️, 📡, ⏹, 🔊, ▶️) en componentes React distribuidos en la capa de entrenamiento. Estos presentan:

- Inconsistencia visual (tamaños, pesos, estilos variables según plataforma)
- Problemas de accesibilidad (screen readers anuncian nombres no intuitivos)
- Falta de coherencia con la estética "Dark Studio DAW" (colores, trazos)
- Imposibilidad de aplicar estilos CSS (color, tamaño, animaciones) de manera uniforme

Verificado en: StudioTopBar.tsx, StudioBottomDock.tsx, DatabaseCard.tsx, FeedbackPanel.tsx y variantes, SingleNoteView.tsx.

## Goals / Non-Goals

**Goals:**

- Reemplazar TODOS los emojis con iconos SVG de `lucide-react` para coherencia visual
- Mantener exacta funcionalidad (handlers, estados, lógica) y accesibilidad (tabIndex, roles, aria-*)
- Aplicar tamaños consistentes: w-4 h-4 o w-3.5 h-3.5 con mr-1.5/mr-1 según contexto
- Utilizar clases Tailwind para color dinámico (text-cyan-400, text-amber-400, fill-current)
- Asegurar tree-shaking: solo los iconos importados se incluyen en bundle final

**Non-Goals:**

- Cambiar la lógica de entrenamiento, adapation engine o modelos de dominio
- Modificar flujos de WebMIDI o manejo de dispositivos de entrada/salida
- Alterar estructura de stores (zustand) o tipos de datos
- Actualizar documentación de usuario o guías de estilo más allá de los componentes afectados

## Decisions

### 1. Seleccionar `lucide-react` sobre alternativas

- **Alternativa considerada**: `heroicons` o `font-awesome`
- **Razón**: `lucide-react` ofrece mejor tree-shaking, estilo lineal técnico que coincide con estética Pro Audio, y ya está en dependencias del proyecto (^1.47.0)
- **Evidence**: Importación selectiva (`import { Music } from 'lucide-react'`) garantiza que solo iconos usados se incluyan

### 2. Mapeo semántico de emojis a iconos Lucide

- 🎹 (piano) → `Music` (icono universal de audio/MIDI)
- 👂 (oído) → `Ear` (para modo blind)
- 👁️ (ojo) → `Eye` (para modo assisted)
- 📥 (entrada) → `Download` (backup/import)
- 📤 (salida) → `Upload` (backup/export)
- 🗑️ (basura) → `RotateCcw` (reset DB - acción cíclica)
- 📡 (antena) → `Terminal` (MIDI monitor - representación de datos)
- ▶️ (play) → `Play` (iniciar sesión/estímulo)
- ⏹ (stop) → `Square` (detener sesión)
- 🔊 (repeat) → `RotateCcw` (repetir estímulo [R])
- ➡️ (avanzar) → `SkipForward` (avanzar [Espacio])

### 3. Consistencia de estilos y tamaños

- **Botones de transporte** (Play, Square, SkipForward): `w-4 h-4 mr-1.5 fill-current` para herencia de color dinámico
- **Iconos de estado/toggle** (Ear, Eye): `w-4 h-4 mr-1.5 text-[color]-400` (cyan/amber según estado)
- **Iconos de acciones** (DatabaseCard, StudioBottomDock): `w-3.5 h-3.5 mr-1` para alineación con texto de botón
- **Iconos de modo** (StudioTopBar pills): `w-4 h-4 mr-1.5` alineados con texto del label
- Todos usan `inline-flex items-center` inherido de contenedores existentes

### 4. Preservación de accesibilidad

- **Screen readers**: Los SVG de Lucide son silenciosos por defecto; texto visible mantiene significado
- **Keyboard navigation**: `tabIndex`, `onClick` y handlers permanecen sin cambios
- **ARIA**: No se requieren modificaciones ya que los iconos son puramente decorativos dentro de botones con labels claros
- **Focus rings**: Tailwind classes de componentes originales (Button, etc.) preservan indicadores de foco

### 5. Estrategia de migración incremental

- **Archivo por archivo**: Verificar compilación y tests después de cada componente
- **Pruebas visuales**: Confirmar renderizado correcto en Windows/macOS (si disponible)
- **Bundle size**: Validar que no haya incremento significativo gracias a tree-shaking
- **Regression testing**: Los 533 tests existentes deben pasar 1:1

## Risks / Trade-offs

[Risk de inconsistencia visual] → Mitigación: Definir guía de mapeo en este documento y validar con revisión de pares
[Risk de iconos incorrectamente importados] → Mitigación: TypeScript detectará imports faltantes; tests unitarios fallarán si cambian props
[Risk de aumento de bundle size] → Mitigación: `lucide-react` es tree-shakeable; solo iconos usados afectan bundle (verificar con `npm run build` y análisis de chunk)
[Risk de falsa sensación de cambio funcional] → Mitigación: Enfatizar en documentación que es refactor estético puro; tests de comportamiento deben ser idénticos

## Migration Plan

1. **Preparación**: Instalar tipos si fueran necesarios (ya incluidos en lucide-react)
2. **Fase 1 - StudioTopBar.tsx**: Reemplazar emojis de modo y toggle audiovisual + Popover MIDI
3. **Fase 2 - StudioBottomDock.tsx + DatabaseCard.tsx**: Actualizar botones de backup/import/reset/monitor
4. **Fase 3 - FeedbackPanel.tsx y variantes**: Modernizar botones de transporte (Play, Square, RotateCcw, SkipForward)
5. **Fase 4 - SingleNoteView.tsx**: Actualizar botones de transporte en header
6. **Validación**: `npm run typecheck` y `npm run test` después de cada fase
7. **Merge**: Pull request con todos los cambios una vez verificados

## Open Questions

Ninguna. Todas las decisiones técnicas están basadas en código existente y dependencias del proyecto.
