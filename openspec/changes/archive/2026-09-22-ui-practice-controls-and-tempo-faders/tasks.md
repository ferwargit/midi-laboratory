## 1. RepertoireView - Fader de Tempo Dual y Micro-ajuste

- [x] 1.1 Rediseñar control Tempo con slider estilo fader consola, track bg-slate-800 y accent-cyan-500, verificar render visual en RepertoireView
- [x] 1.2 Añadir botones -1 BPM y +1 BPM flanqueando slider, verificar callbacks onChange preservados y BPM se actualiza
- [x] 1.3 Implementar lectura dual tabular `tabular-nums font-mono text-cyan-400 font-semibold` con formato `${bpm} BPM (~${ms}ms/negra)`, verificar texto coincide

## 2. RepertoireView - LEDs de Metrónomo y Conmutadores

- [x] 2.1 Implementar diodos LED circulares con altura fija y contenedor estable, downbeat bg-cyan-400 shadow pulso, tiempos débiles bg-slate-400/bg-amber-400, verificar CLS = 0 inspeccionando layout
- [x] 2.2 Crear conmutador segmentado Mano a Estudiar MD/MI/both con active:scale-[0.98] y estado activo cian/púrpura, verificar selección cambia estado
- [x] 2.3 Crear conmutador segmentado Estrategia Encadenamiento forward/backward y checkbox +1 Res, verificar eventos onChange intactos

## 3. Unificación de Decks en Cuatro Modalidades

- [x] 3.1 Actualizar estilos de <select> en RepertoireView a `bg-slate-900/90 border-slate-700/60 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500`, verificar focus ring
- [x] 3.2 Actualizar etiquetas de sección a `text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2`, verificar tipografía uniforme
- [x] 3.3 Unificar selectores de presets/rangos con tarjetas compactas consistentes con Card.tsx en RepertoireView, verificar interacción
- [x] 3.4 Repetir unificación de decks en SingleNoteView.tsx: selectores, etiquetas y tarjetas, verificar render sin errores
- [x] 3.5 Repetir unificación de decks en IntervalsView.tsx, verificar callbacks preservados
- [x] 3.6 Repetir unificación de decks en SequencesView.tsx, verificar callbacks preservados

## 4. Calidad y Compatibilidad

- [x] 4.1 Ejecutar `npx prettier --write` sobre los cuatro archivos modificados, verificar diff limpio
- [x] 4.2 Ejecutar `npm run typecheck`, verificar cero errores de tipos
- [x] 4.3 Ejecutar `npm run test`, verificar los 573 tests pasan limpios
- [x] 4.4 Revisar manualmente que callbacks onChange y handlers de trainers no fueron alterados, verificar comportamiento funcional
