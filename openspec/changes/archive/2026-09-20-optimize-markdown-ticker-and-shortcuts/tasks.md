## 1. Pruebas primero (Red) — Protocolo TDD

- [x] 1.1 Ampliar `src/renderer/src/components/ui/MarkdownRenderer.test.tsx` con una suite de memoización: `vi.spyOn(markdownParser, 'parseMarkdownBlocks')` (delegando a la implementación real) demuestra que el parser se invoca una sola vez ante re-renders con props idénticos (memo short-circuit ⇒ sin re-parseo), y los casos de equivalencia demuestran que al cambiar `content` se re-parsea, mientras que un cambio solo de `className` intencionalmente no. Verificar con `npx vitest run src/renderer/src/components/ui/MarkdownRenderer.test.tsx` — los nuevos tests deben FALLAR (Red) antes de tocar el componente.
- [x] 1.2 Crear `src/renderer/src/services/keyboard/shortcutDecision.test.ts` con la tabla de casos pura: Space sin modalidad en espera ⇒ `shouldPreventDefault === false`; Space con modalidad en espera ⇒ `shouldPreventDefault === true` y `action === 'advance'`; Space en `analytics` ⇒ `shouldPreventDefault === false`; `R` limpio ⇒ `action === 'repeat'`; `Ctrl+R`, `Meta+R`, `Alt+R` ⇒ `action === null`; `Shift+R` ⇒ `action === 'repeat'`. Verificar con `npx vitest run src/renderer/src/services/keyboard/shortcutDecision.test.ts` — debe FALLAR (el módulo aún no existe).
- [x] 1.3 Crear `src/renderer/src/components/views/analytics/AiConsultationTab.test.tsx`: con `isAnswering === true` y `reasoningSeconds` avanzando mediante fake timers, los items del historial persistente no se re-renderizan (el contador de renders de los items se mantiene igual al número de consultas) y su markdown se parsea una sola vez. Verificar con `npx vitest run src/renderer/src/components/views/analytics/AiConsultationTab.test.tsx` — debe FALLAR (Red).

## 2. Atajos de teclado (F5-04 y F5-15)

- [x] 2.1 Implementar `src/renderer/src/services/keyboard/shortcutDecision.ts` (función pura `resolveShortcutDecision(event, ctx)` + tipos `ShortcutAction`/`ShortcutContext`) según design.md D5. Verificar: `npx vitest run src/renderer/src/services/keyboard/shortcutDecision.test.ts` en Green.
- [x] 2.2 Cablear `resolveShortcutDecision` en el `handleKeyDown` de `src/renderer/src/App.tsx`: llamar a `e.preventDefault()` únicamente cuando `shouldPreventDefault === true` (es decir, solo si la modalidad activa está esperando avance manual), y despachar la acción de avance/repetición correspondiente. Conservar los guards existentes de `isResetModalOpen` e `isTyping`. Verificar: `npm run typecheck` sin errores y la rama de Space ya no contiene `e.preventDefault()` incondicional.
- [x] 2.3 Confirmar que la dependencia del `useEffect` sigue incluyendo los ocho flags `*Waiting`/`*Active` actuales (`App.tsx:530-549`) y que `Shift+R` sigue disparando la repetición. Verificar: `npx vitest run src/renderer/src/services/keyboard/shortcutDecision.test.ts` y revisión manual del diff de `App.tsx`.

## 3. Optimización de MarkdownRenderer (F5-03)

- [x] 3.1 Envolver `MarkdownRenderer` en `React.memo` y reemplazar la llamada directa a `parseMarkdownBlocks(content)` por `useMemo(() => parseMarkdownBlocks(content ?? ''), [content])`, moviendo el early-return de contenido vacío DESPUÉS del hook (design.md D1). Verificar: `npx vitest run src/renderer/src/components/ui/MarkdownRenderer.test.tsx` en Green, incluido el caso vacío→no-vacío.
- [x] 3.2 Confirmar que el DOM renderizado es idéntico al anterior: los 6 tests existentes de parser (texto plano, negrita/código, headings, tablas, listas, bloques de código y citas) siguen pasando sin modificación. Verificar: `npx vitest run src/renderer/src/components/ui/MarkdownRenderer.test.tsx`.

## 4. Aislamiento del ticker de IA (F5-03)

- [x] 4.1 Extraer el JSX del item de historial (`AiConsultationTab.tsx:212-261`) a un subcomponente module-private `ConsultationHistoryItem` envuelto en `React.memo`, que reciba únicamente el objeto `consultation` (design.md D2). Verificar: `npx vitest run src/renderer/src/components/views/analytics/AiConsultationTab.test.tsx` en Green.
- [x] 4.2 Actualizar el `map` de `filteredConsultations` para renderizar `<ConsultationHistoryItem key={c.id} consultation={c} />`; la rama de historial vacío y el contenedor scrollable se mantienen en el padre. Verificar: `npm run typecheck` sin errores.

## 5. Verificación de cierre (Green completo)

- [x] 5.1 Ejecutar la suite completa no interactiva: `npm run test` — todos los tests (nuevos y preexistentes) deben pasar.
- [x] 5.2 Ejecutar `npm run typecheck` y `npm run lint` — sin errores ni advertencias nuevas.
- [x] 5.3 Validación formal del cambio: `openspec validate optimize-markdown-ticker-and-shortcuts --strict` debe reportar el cambio válido con `skip_specs: true`.
