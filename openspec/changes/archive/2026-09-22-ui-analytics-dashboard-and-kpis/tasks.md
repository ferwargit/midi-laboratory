## 1. Preparación y verificación

- [x] 1.1 Confirmar árbol de componentes objetivo y verificar que los 4 archivos existen
- [x] 1.2 Revisar imports Lucide y validar disponibilidad de iconos Table, Sparkles, MessageSquare, TrendingUp, Grid3X3, LineChart, History

## 2. AnalyticsTabNav modernización

- [x] 2.1 Reemplazar labels con emoji por iconos Lucide y texto, implementar píldoras segmentadas con clases de estado activo cian eléctrico y bordes
- [x] 2.2 Añadir badges de conteo numérico con tabular-nums font-mono text-[10px] y verificar renderizado correcto para sessions, longitudinal, ai_history
- [x] 2.3 Validar foco visible y accesibilidad de teclado en botones de pestaña

## 3. AnalyticsKpiCards modernización

- [x] 3.1 Cambiar fondo a bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 y tipografía tabular-nums font-mono text-2xl font-bold
- [x] 3.2 Aplicar escala semántica esmeralda/ámbar/rosa carmesí para IRT usando MASTERY_THRESHOLDS existente y verificar colores
- [x] 3.3 Asegurar tooltips pedagógicos con focus-visible:ring-2 focus-visible:ring-cyan-500 y accesibilidad

## 4. AnalyticsFilterBar modernización

- [x] 4.1 Convertir selector Modalidad a píldora segmentada con micro-interacción suave y estilos Dark Studio DAW
- [x] 4.2 Actualizar todos los dropdowns a clase canónica bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-colors
- [x] 4.3 Reemplazar búsqueda por campo con icono Lucide Search y botón reset con RotateCcw, verificar funcionalidad de reset

## 5. AnalyticsView contenedor

- [x] 5.1 Aplicar fondo #0d0f14 y espaciado consistente en contenedor principal
- [x] 5.2 Estilizar banner de aislamiento en ámbar neón con contraste adecuado

## 6. Calidad y verificación

- [x] 6.1 Ejecutar npx prettier --write en los 4 archivos objetivo y confirmar sin diffs
- [x] 6.2 Ejecutar npm run typecheck y verificar cero errores
- [x] 6.3 Ejecutar npm run test y verificar 573 tests pasando sin regresiones
- [x] 6.4 Revisar manualmente que displayedMetrics y pipeline de dominio puro permanecen intactos
