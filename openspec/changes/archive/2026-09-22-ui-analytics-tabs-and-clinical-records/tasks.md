## 1. Preparación y validación

- [x] 1.1 Verificar que los 5 archivos objetivo existen y leer imports para confirmar contratos sin cambios
- [x] 1.2 Ejecutar `npm run typecheck` y `npm run test` baseline y confirmar 573 tests pasan

## 2. Modernización SessionsTableTab

- [x] 2.1 Reemplazar wrapper Card a fondo rack `bg-slate-900/90 border border-slate-800/80 rounded-xl overflow-hidden` y verificar render visual
- [x] 2.2 Aplicar `tabular-nums font-mono text-xs` a métricas dinámicas Score CPI, preguntas, duración, precisión %, Oído Real %, reflejo %, RPM y verificar tipografía tabular
- [x] 2.3 Implementar badges de maestría con clases esmeralda >=85%, ámbar 60-84%, carmesí <60% y verificar colores
- [x] 2.4 Cambiar botones de acción por fila a iconos Lucide <Search/> Detalle, <Play/> Re-testar, <Trash2/> Eliminar y verificar que SessionDetailModal sigue abriéndose vía portal
- [x] 2.5 Re-estilizar barra flotante de acciones múltiples con panel rack oscuro y verificar estilo

## 3. Modernización AiDiagnosticTab

- [x] 3.1 Mantener diseño limpio sin selectores duplicados y verificar ausencia de duplicaciones
- [x] 3.2 Aplicar efecto hardware glow="cyan" a tarjeta de Prescripción y verificar render
- [x] 3.3 Estilizar chips de parámetros modo/timbre/límite/tonos con `tabular-nums font-mono` y verificar tipografía
- [x] 3.4 Destacar botón de transporte y verificar contraste

## 4. Modernización AiConsultationTab

- [x] 4.1 Cambiar textarea a `bg-slate-900/90 border border-slate-700/60 rounded-xl` y verificar estilo oscuro
- [x] 4.2 Estilizar barra de acción inferior con chips táctiles y verificar interactividad
- [x] 4.3 Confirmar memoización de ConsultationHistoryItem preservada y verificar con typecheck

## 5. Modernización LongitudinalTab

- [x] 5.1 Crear cuadrícula comparativa Baseline/Retest/Deltas con tarjetas alta resolución y verificar layout
- [x] 5.2 Aplicar colores de dirección delta verde mejora / rojo retroceso y verificar indicadores numéricos

## 6. Modernización AiHistoryTab

- [x] 6.1 Re-estilizar tarjetas de reporte en formato hardware y verificar previsualización de prescripciones

## 7. Calidad y cierre

- [x] 7.1 Ejecutar `npx prettier --write` sobre los 5 archivos y confirmar cero diffs en `npm run format`
- [x] 7.2 Ejecutar `npm run typecheck` y confirmar sin errores
- [x] 7.3 Ejecutar `npm run test` y confirmar 573 tests pasan limpios
