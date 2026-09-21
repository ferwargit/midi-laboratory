## Why

El reporte de cobertura de Vitest muestra cuatro módulos de dominio con
cobertura de ramas insuficiente o nula: `defaultScore.ts` (0% líneas, nunca
importado por ninguna prueba), `latencyStats.ts` (58% ramas),
`longitudinal.ts` (51% ramas) y `sessionFilters.ts` (55% ramas). Estos
módulos contienen lógica de ramificación densa (filtros encadenados,
reconstrucción de configuración histórica, clasificación por octavas) cuyo
comportamiento de borde no está verificado, por lo que una refactoración
incluso menor puede romper silenciosamente la analítica y la partitura por
defecto.

## What Changes

- **Nuevo** `src/renderer/src/domain/music/defaultScore.test.ts`: valida que
  `DEFAULT_PARTITURA_XML` es un string no vacío y que al parsearlo con
  `parseMusicXml` produce un modelo íntegro (título "Partitura 1",
  `baseBpm === 86`, compás 2/4, `totalMeasures > 0`, eventos melódicos y
  armónicos válidos). Lleva `defaultScore.ts` de 0% a 100%.
- **Nuevo** `src/renderer/src/domain/analytics/sessionFilters.test.ts`: cubre
  las ramas de `filterSessionsAdvanced` por instrumento, estrategia, preset
  (incluyendo los aliases de nivel 3/4, pentatónica y personalizadas), los
  sub-formatos de tiempo (`time_1`, `time_3`, `time_5`, `time_10`) y de
  preguntas (`questions_5`, `questions_10`, `questions_20`), el filtro por
  tamaño de pool y la búsqueda por texto sobre preset, instrumento y
  estrategia. Eleva las ramas de 55% a 95%+.
- **Nuevo** `src/renderer/src/domain/analytics/longitudinal.test.ts`: cubre
  `reconstructSessionConfig` en sesiones de intervalos (extracción de
  `recommendedIntervals` por telemetría con regex y fallback), sesiones de
  secuencias (extracción de `recommendedNotes` y `sequenceLength`) y el
  fallback de notas seguras (`>= 2` notas únicas) ante respuestas vacías o
  repetidas; también `computeLongitudinalComparisons` sobre grupos de 3+
  sesiones verificando baseline = primera y latest = última. Eleva las ramas
  de 51% a 95%+.
- **Nuevo** `src/renderer/src/domain/analytics/longitudinal.mock.test.ts`:
  suite complementaria que aísla `reconstructSessionConfig` con
  `vi.mock('../music/presets', () => ({ EXERCISE_PRESETS: [] }))` para
  ejercitar los fallbacks documentados de notas cuando un preset no se
  encuentra en el catálogo (ramas `|| [...]` defensivas de `longitudinal.ts`),
  que de otro modo son inalcanzables. Sigue el precedente de
  `src/renderer/src/domain/ai/lmStudioService.mock.test.ts`.
- **Nuevo** `src/renderer/src/domain/analytics/latencyStats.test.ts`: cubre
  `computePerNoteLatencyStats` con respuestas donde ninguna es correcta
  (`fastestNote === null`, `slowestNote === null`, latencias en 0) y la
  clasificación por octavas (octava 3 grave, octava 4 central, otras agudas)
  y `fastestOctave`. Eleva las ramas de 58% a 95%+.

  Total: 5 archivos `*.test.ts`.

No se modifica código de producción: solo se añaden suites de pruebas
unitarias que ejercitan ramas existentes.

## Capabilities

### New Capabilities

Ninguna. Este cambio no introduce capacidades nuevas: se limita a blindar con
pruebas unitarias el comportamiento ya especificado y entregado por los
módulos existentes.

### Modified Capabilities

Ninguna. Los requisitos de las capacidades `03-practice-modalities`,
`04-adaptation-algorithms` y `05-analytics-psychometrics` permanecen
inalterados; no hay cambios de comportamiento, solo de cobertura de pruebas.

## Impact

- **Código afectado**: solo se añaden 5 archivos `*.test.ts` bajo
  `src/renderer/src/domain/` (music y analytics; el quinto, `longitudinal.mock.test.ts`,
  aísla los fallbacks de presets con `vi.mock`). Cero líneas de producción
  modificadas.
- **Dependencias**: usa la infraestructura Vitest existente y los mismos
  fixtures in-memory estilo `historyAnalytics.test.ts` (objetos
  `DbSessionRecord` / `DbAnswerRecord`), sin imports de paquetes externos. El
  único mock es `EXERCISE_PRESETS` en la suite aislada, con la utilidad
  `vi.mock` ya disponible en Vitest.
- **CI/tiempo de test**: incremento despreciable; las suites son puras y
  síncronas.
- **Validación**: `npm run test` (vitest run) debe mantenerse verde y la
  cobertura de los cuatro módulos debe alcanzar 95%+ en ramas.
