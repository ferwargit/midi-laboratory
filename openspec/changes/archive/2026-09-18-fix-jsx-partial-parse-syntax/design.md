## Context

Tres componentes renderer presentan `&` literales en texto JSX que disparan recuperación de
errores en tree-sitter TSX (rangos confirmados: `SessionsTableTab.tsx:257,267`,
`KnowledgeGuideModal.tsx:43`, `LatencySpectrumDiagram.tsx:12`). Ver `proposal.md` — Why para
la motivación y la evidencia de la convención existente de escaping en el propio codebase.

El alcance es estrictamente textual: cuatro sustituciones de un carácter. Lo que requiere
decisión técnica es **cómo** escapar y **cómo** verificar la corrección sin alterar la
salida renderizada.

## Goals / Non-Goals

**Goals:**

- Eliminar los cuatro nodos de error de tree-sitter restaurando texto JSX sintácticamente
  válido según la gramática HTML/XML.
- Preservar el 100% del diseño visual y la funcionalidad: el DOM y el texto visible deben
  ser idénticos antes y después.
- Sentar la verificación en dos vías: (a) reindexación de codebase-memory-mcp con cobertura
  completa y cero `parse_partial`, y (b) `npm run typecheck` + `npm run test` sin regresiones.

**Non-Goals:**

- No refactorizar la estructura de los componentes, ni renombrar, ni reordenar.
- No tocar literales de cadena de TS que contienen `&` (son TS válido y no están flaggeados;
  ver `proposal.md` — Impact, exclusión deliberada).
- No introducir linting nuevo ni reglas de ESLint; la corrección de estilo es puntual.
- No alterar ninguna spec canónica (cambio declarado `skip_specs: true`).

## Decisions

**Decisión 1: Usar la entidad HTML `&amp;` en vez de un contenedor de expresión JSX
`{'&'}`.**

- _Rationale:_ `&amp;` es la corrección mínima e idiomática, es la forma en que el resto del
  codebase ya escapa (`SingleNoteView.tsx:90,92`, `SessionDetailModal.tsx:626,628`,
  `AnalyticsFilterBar.tsx:256,288,290`), y produce el DOM renderizado idéntico. El navegador
  decodifica `&amp;` al carácter `&`, de modo que el texto visible y el layout no cambian.
- _Alternativa considerada:_ `{'&'}` también es válido y elimina el error de parseo, pero es
  más verboso, introduce un nodo de expresión innecesario en el AST y es inconsistente con la
  convención del proyecto. Descartado.

**Decisión 2: Corrección in place, sin tocar `className` ni estilos.**

- _Rationale:_ Los rangos flaggeados son nodos de texto puro dentro de `<span>`/`<h2>`. La
  sustitución se limita al contenido textual; cero impacto en Tailwind, layout o eventos.

**Decisión 3: Verificación doble (grafo + toolchain), no solo "se ve igual".**

- _Rationale:_ La corrección es invisible a simple vista por diseño. Por eso la aceptación se
  basa en evidencia objetiva: (a) `index_status`/`check_index_coverage` de
  codebase-memory-mcp reportando cobertura completa y `parse_partial` vacío para los tres
  archivos tras reindexar, y (b) `npm run typecheck` y `npm run test` pasando. Sin estos
  checks, una corrección incompleta o un falso positivo pasarían desapercibidos.

## Risks / Trade-offs

- [Riesgo: sobrecorrer el alcance y escapar `&` que no están en texto JSX] → Mitigación: la
  lista de blancos es exactamente cuatro líneas verificadas contra el reporte del indexador;
  los literales de cadena TS quedan explícitamente excluidos.
- [Riesgo: el error de parseo reaparezca por otros caracteres no escapados en los mismos
  archivos] → Mitigación: tras la corrección, reindexar y confirmar que `parse_partial` queda
  vacío para los tres archivos; si aparecen rangos nuevos, se diagnostican antes de cerrar.
- [Riesgo: falso positivo del indexador que no refleje un error real] → Mitigación: el
  caracter sí es inválido según la gramática HTML/XML aunque Babel/swc lo toleren; la
  corrección es estrictamente beneficiosa y no depende de si el bundler lo hubiera aceptado.
- [Trade-off: `&amp;` es ligeramente menos legible en el fuente que un `&` suelto] → Aceptado:
  es el precio estándar del JSX correcto y ya es la norma del proyecto.

## Migration Plan

- _Despliegue:_ un commit atómico con las cuatro sustituciones; al ser solo texto JSX, no hay
  migración de datos ni versiones de paquetes.
- _Rollback:_ `git revert` del commit restaura el estado anterior sin efectos colaterales.
