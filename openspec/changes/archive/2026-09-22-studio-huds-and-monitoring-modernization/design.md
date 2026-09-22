## Context

Los componentes de HUDs permanentes de estudio (StudioTopBar, StudioBottomDock, MidiMonitor) forman parte del sistema de interfaz del entrenador MIDI. Estos componentes operan en el hot-path de eventos MIDI, donde los cambios en el estado de logs pueden desencadenar re-renderizados innecesarios en todo el árbol de componentes.

Los hallazgos de auditoría V6 identificados:
- F5-12: Re-renderizados innecesarios por cambios en estado de logs de MIDI
- F5-17: Popovers sin manejo de Escape/click-outside
- F5-11: Degradación de rendimiento por animaciones de scroll acumuladas

Los componentes deben mantener compatibilidad con el sistema de temas oscuro de Dark Studio DAW y las prácticas de React 19 para protección de hot-path.

## Goals / Non-Goals

**Goals:**
- Eliminar re-renderizados innecesarios mediante memoización con React.memo
- Implementar manejo adecuado de eventos de teclado (Escape) y click-outside para accesibilidad
- Optimizar rendimiento de auto-scroll para tráfico MIDI intensivo
- Aplicar tipografía tabular-nums para valores numéricos en tiempo real
- Mejorar semántica visual de logs MIDI con badges estilizados
- Mantener consistencia visual con la estética de Dark Studio DAW

**Non-Goals:**
- No modificar funcionalidad de dominio relacionada con procesamiento MIDI
- No cambiar APIs públicas de componentes
- No introducir nuevas dependencias externas
- No modificar lógica de negocio de modo de rendimiento/calidad

## Decisions

**React.memo para prevención de re-renderizados**

Se aplicará React.memo a StudioTopBar y StudioBottomDock para prevenir re-renderizados causados por cambios en el estado de logs de MIDI que no afectan a estos componentes. La comparación de props debe considerar que los botones de modo mantienen el estado disabled={isSessionActive} que depende del contexto de sesión.

Alternativa considerada: useMemo en nivel de padre, pero React.memo es más localizado y evita propagación de re-renders innecesarios a componentes descendientes.

**Manejo de Escape y click-outside en Popover**

Implementar listener de tecla Escape mediante useEffect con cleanup y detector de click-outside mediante ref en el contenedor del popover. Esta solución es preferible sobre librerías externas para mantener el bundle pequeño y evitar dependencias adicionales.

Alternativa considerada: headless UI combinados, pero aumentaría la superficie de dependencias sin beneficios medibles para este caso de uso específico.

**Auto-scroll instantáneo**

Reemplazar behavior: 'smooth' por behavior: 'auto' en MidiMonitor para eliminar encolamiento de animaciones bajo tráfico MIDI rápido. Esto garantiza desplazamiento a 60 FPS sin acumulación de cola de animaciones.

Alternativa considerada: throttling/debouncing con requestAnimationFrame, pero el cambio a 'auto' es más simple y cumple el requisito de rendimiento sin introducir complejidad adicional.

**Estilizado de badges con font-mono**

Aplicar font-mono a las fichas de tipo de log para consistencia con métricas de performance en tiempo real. Los colores semánticos mantienen coherencia con la paleta establecida: cyan para IN, purple para OUT, amber para EVAL, emerald para AI.

## Risks / Trade-offs

**Risk**: React.memo puede ocultar bugs de props mutadas → Mitigation: Auditar props inmutables en componentes memoizados, especialmente los objetos de configuración MIDI

**Risk**: Cambios de comportamiento en auto-scroll pueden afectar percepción de usuario → Mitigation: Estándar de industria para monitoreo en tiempo real es scroll instantáneo; el comportamiento smooth es anti-patrones para logs de alta frecuencia

**Risk**: Manejo manual de Escape puede interferir con navegación de teclado → Mitigation: Verificar event propagation y detener propagation solo en el popover activo