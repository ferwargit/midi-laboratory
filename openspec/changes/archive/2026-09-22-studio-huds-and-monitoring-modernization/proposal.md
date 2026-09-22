## Why

Modernizar los HUDs permanentes de estudio y monitoreo telemétrico (StudioTopBar, StudioBottomDock y MidiMonitor) para resolver los hallazgos de auditoría V6 (F5-11, F5-12, F5-17) relacionados con problemas de rendimiento, accesibilidad y experiencia de usuario. Los componentes actuales presentan re-renderizados innecesarios, falta de manejo adecuado de eventos de teclado y problemas de scroll que degradan la experiencia bajo cargas intensas de datos MIDI.

## What Changes

- Envuelve StudioTopBar en React.memo para prevenir re-renderizados innecesarios
- Implementa cierre de popover de puertos MIDI con tecla Escape y click-outside en StudioTopBar
- Envuelve StudioBottomDock en React.memo y aplica tabular-nums font-mono a KPIs numéricos
- Añade botón de apertura/cierre del drawer de telemetría con iconos dinámicos y animación fluida en StudioBottomDock
- Optimiza auto-scroll en MidiMonitor reemplazando behavior: 'smooth' por behavior: 'auto'
- Estiliza fichas de tipo de log con colores semánticos y font-mono en MidiMonitor
- Añade estado vacío informativo cuando no hay eventos MIDI en MidiMonitor
- Actualiza pruebas unitarias para validar los nuevos comportamientos

## Capabilities

### Modified Capabilities

- `studio-huds`: Actualiza los requisitos de comportamiento para StudioTopBar, StudioBottomDock y MidiMonitor incorporando mejoras de rendimiento, accesibilidad y experiencia de usuario sin alterar la funcionalidad central del dominio.

## Impact

- Archivos modificados: 
  - src/renderer/src/components/trainer/StudioTopBar.tsx
  - src/renderer/src/components/trainer/StudioBottomDock.tsx
  - src/renderer/src/components/trainer/MidiMonitor.tsx
  - Tests unitarios correspondientes en src/renderer/src/components/trainer/
- No se afectan APIs públicas ni contratos de dominio
- Mejora de rendimiento bajo cargas intensas de MIDI
- Mejor accesibilidad mediante manejo adecuado de teclado
- Experiencia de usuario más fluida y predecible