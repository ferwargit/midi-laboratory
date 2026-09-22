## Why

La FASE 4.3 requiere modernizar la UX de las pestañas analíticas y registro clínico bajo las directrices Dark Studio DAW de AGENTS.md. La interfaz actual no cumple con la estética de rack oscuro, tipografía tabular para métricas dinámicas, ni paleta semántica de maestría, afectando legibilidad y consistencia visual del producto.

## What Changes

- Modernización visual de SessionsTableTab.tsx: tabla de alta densidad con fondo `bg-slate-900/90`, métricas numéricas con `tabular-nums font-mono text-xs`, badges de maestría esmeralda/ámbar/carmesí (>=85%/60-84%/<60%), acciones por fila con iconos Lucide y barra flotante de acciones múltiples estilo rack.
- Modernización de AiDiagnosticTab.tsx: mantener diseño limpio, tarjeta de Prescripción con glow cyan, chips de parámetros en tabular-nums, HUD de razonamiento.
- Modernización de AiConsultationTab.tsx: textarea oscuro `bg-slate-900/90 border border-slate-700/60`, barra de acción inferior con chips táctiles, preservar memoización de ConsultationHistoryItem.
- Modernización de LongitudinalTab.tsx: cuadrícula comparativa Baseline/Retest/Deltas con colores de dirección verde/rojo.
- Modernización de AiHistoryTab.tsx: tarjetas de reporte con formato hardware y previsualización de prescripciones.
- Formateo con Prettier y verificación de typecheck/tests sin regresiones.

## Capabilities

### New Capabilities
Ninguna. Cambio de presentación visual sin cambios de comportamiento de dominio.

### Modified Capabilities
Ninguna. Modificaciones solo de UI/estilo; no cambia requisitos funcionales.

## Impact

- src/renderer/src/components/views/analytics/SessionsTableTab.tsx
- src/renderer/src/components/views/analytics/AiDiagnosticTab.tsx
- src/renderer/src/components/views/analytics/AiConsultationTab.tsx
- src/renderer/src/components/views/analytics/LongitudinalTab.tsx
- src/renderer/src/components/views/analytics/AiHistoryTab.tsx

Preservación 100% de lógica de datos, handlers y contratos. Sin cambios de APIs. Pruebas existentes (573) deben seguir pasando.
