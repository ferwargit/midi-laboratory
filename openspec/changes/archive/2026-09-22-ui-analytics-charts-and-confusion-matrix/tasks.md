## 1. Preparación

- [x] 1.1 Verificar existencia de AnalyticsCharts.tsx y ConfusionMatrixTab.tsx y revisar imports Lucide disponibles
- [x] 1.2 Confirmar que los cálculos de psicometría y matriz de confusión no se modifican, solo UI

## 2. AnalyticsCharts modernización

- [x] 2.1 Actualizar rejilla SVG a stroke-slate-800/60 y trazado spline stroke-cyan-400 con micro-glow, verificar renderizado en curva temporal
- [x] 2.2 Implementar tooltip flotante hardware con tabular-nums font-mono y sombra nítida
- [x] 2.3 Modernizar gráficos de barras a estética analizador de frecuencias con micro-bordes y gradientes, validar con SSOT COGNITIVE_LATENCY_THRESHOLDS
- [x] 2.4 Actualizar histograma sesgo direccional con +st ámbar / -st cian y tipografía tabular
- [x] 2.5 Reemplazar emojis por iconos Lucide TrendingUp, BarChart3, Clock, Layers, Sparkles

## 3. ConfusionMatrixTab modernización

- [x] 3.1 Estilizar cuadrícula 12x12 con border-slate-800/80 y fondo estudio
- [x] 3.2 Resaltar diagonal de aciertos con bg-emerald-950/40 text-emerald-300 border-emerald-500/30 font-semibold
- [x] 3.3 Implementar escala térmica de confusión basada en maxOffDiagonalCount con gradientes estudio
- [x] 3.4 Crear panel OLED de explicación psicoacústica con altura reservada para CLS=0
- [x] 3.5 Modernizar paneles laterales Top Pares Confundidos y Distribución Velocidad con aspecto rack y tabular-nums font-mono

## 4. Calidad y verificación

- [x] 4.1 Ejecutar npx prettier --write en ambos archivos y confirmar sin diffs
- [x] 4.2 Ejecutar npm run typecheck y verificar cero errores
- [x] 4.3 Ejecutar npm run test y verificar 573 tests pasando sin regresiones
- [x] 4.4 Revisar manualmente que cálculos y props públicas permanecen intactos
