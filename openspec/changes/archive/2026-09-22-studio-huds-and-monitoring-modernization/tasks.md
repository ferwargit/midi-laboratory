## 1. Setup y Validación Inicial

- [x] 1.1 Verificar que todos los componentes objetivo existen en las rutas especificadas y crear backup de archivos originales
- [x] 1.2 Ejecutar npm run test para confirmar que los 573 tests pasan antes de iniciar cambios
- [x] 1.3 Ejecutar npm run typecheck para validar que no existen errores de tipos iniciales

## 2. Modernización de StudioTopBar

- [x] 2.1 Envolver StudioTopBar en React.memo y verificar que el componente se re-renderiza solo cuando props cambian realmente
- [x] 2.2 Implementar listener de tecla Escape para cerrar popover de configuración de puertos MIDI usando useEffect con cleanup
- [x] 2.3 Implementar detector de click-outside mediante ref en contenedor del popover para cerrar automáticamente
- [x] 2.4 Verificar que los iconos vectoriales de Lucide se mantienen intactos y estados disabled={isSessionActive} funcionan correctamente
- [x] 2.5 Ejecutar pruebas unitarias específicas para StudioTopBar y verificar que popover se cierra con Escape y click-outside

## 3. Modernización de StudioBottomDock

- [x] 3.1 Envolver StudioBottomDock en React.memo y verificar reducción de re-renderizados innecesarios
- [x] 3.2 Aplicar clase tabular-nums font-mono a valores numéricos del resumen (sesiones, precisión %, tiempo)
- [x] 3.3 Implementar botón de apertura/cierre del drawer de telemetría con icono dinámico <ChevronUp/> / <ChevronDown/>
- [x] 3.4 Añadir animación fluida al drawer de telemetría usando transiciones CSS
- [x] 3.5 Verificar que los KPIs numéricos no presentan micro-desplazamientos al actualizarse

## 4. Modernización de MidiMonitor

- [x] 4.1 Reemplazar behavior: 'smooth' por behavior: 'auto' en scrollIntoView para auto-scroll instantáneo
- [x] 4.2 Verificar rendimiento del auto-scroll bajo tráfico MIDI rápido (sin encolamiento de animaciones)
- [x] 4.3 Añadir clase font-mono a las fichas de tipo de log con estilos semánticos:
  - IN: bg-cyan-950/40 text-cyan-400 border border-cyan-500/30
  - OUT: bg-purple-950/40 text-purple-400 border border-purple-500/30
  - EVAL: bg-amber-950/40 text-amber-400 border border-amber-500/30
  - AI: bg-emerald-950/40 text-emerald-400 border border-emerald-500/30
- [x] 4.4 Implementar estado vacío informativo cuando logs.length === 0 con mensaje "Esperando eventos en el bus MIDI..."
- [x] 4.5 Verificar renderizado correcto de badges semánticos y auto-scroll instantáneo en pruebas unitarias

## 5. Verificación y Pruebas

- [x] 5.1 Actualizar/crear pruebas unitarias en src/renderer/src/components/trainer/ para validar:
  - StudioTopBar: popover se cierra con tecla Escape y click-outside
  - MidiMonitor: renderizado de badges semánticos y auto-scroll instantáneo
- [x] 5.2 Ejecutar npm run test y verificar que los 573 tests continúen pasando limpios
- [x] 5.3 Ejecutar npm run typecheck y verificar que no se introdujeron errores de tipos
- [x] 5.4 Ejecutar npm run lint y verificar que el código cumple con el linter del proyecto
- [x] 5.5 Formatear archivos modificados con npx prettier --write y verificar que npm run format no produce diferencias

## 6. Validación Final

- [x] 6.1 Validar cambio con openspec validate studio-huds-and-monitoring-modernization --strict
- [x] 6.2 Revisar manualmente los componentes en el UI para confirmar:
  - Popover se cierra intuitivamente con Escape/click-outside
  - Valores numéricos no tienen jitter horizontal
  - Auto-scroll es instantáneo bajo carga
  - Badges tienen colores semánticos correctos