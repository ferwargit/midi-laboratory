## 1. Pruebas de rendimiento (TDD — Red primero)

- [x] 1.1 Escribir en `s3-render-performance.test.tsx`` la prueba de contrato: renderizar `PianoKeyboard`con un spy contador de renders, hacer rerender con exactamente las mismas referencias de props, y afirmar que el contador NO aumenta (el short-circuit de la memoización funciona). Verificación:`npm run test` — la prueba debe fallar (Red) contra la implementación actual.
- [x] 1.2 Escribir la prueba de tecla individual: afirmar que ante un evento irrelevante de UI (re-render del padre con props estables) ninguna `PianoKey` incrementa su contador de render. Verificación: `npm run test` — debe fallar (Red) antes de existir `PianoKey`.
- [x] 1.3 Escribir las pruebas de equivalencia funcional: (a) clic virtual en una tecla invoca `onPlayNoteVirtual`/`onToggleNote` con la nota correcta y produce el estilo "pulsada"; (b) una nota en `pressedNotes` resalta la tecla correspondiente; (c) la prioridad visual pulsada > estímulo > heatmap > activa > default se respeta; (d) las teclas negras mantienen su posicionamiento por offset. Verificación: `npm run test` — deben pasar tanto antes como después del refactor (son la red de seguridad anti-regresión).

## 2. Estabilización de identidades en App.tsx

- [x] 2.1 Declarar a nivel de módulo `const EMPTY_STIMULUS_NOTES: number[] = []` y usarlo en la asignación de `liveStimulusNotes` (App.tsx:626) en lugar del literal `[]`. Verificación: `npm run typecheck` sin errores; la rama blind devuelve identidad estable.
- [x] 2.2 Estabilizar `handleVirtualKeyPress`: tras memoizar los trainers (tarea 3.x), confirmar que su dependency list `[midi, appMode, singleNoteTrainer, intervalTrainer, sequenceTrainer, repertoireTrainer]` deja de cambiar en cada render. Verificación: `npm run lint` (react-hooks/exhaustive-deps) y la prueba 1.1 pasan (Green).

## 3. Memoización de hooks de entrenamiento

- [x] 3.1 Envolver el objeto de retorno de `useSingleNoteTrainer` en `useMemo` con dependencias exhaustivas (un campo por cada valor retornado). Verificación: `npm run typecheck && npm run lint && npm run test` pasan; las pruebas existentes del trainer no regresan.
- [x] 3.2 Ídem para `useIntervalTrainer`. Verificación: `npm run typecheck && npm run lint && npm run test`.
- [x] 3.3 Ídem para `useSequenceTrainer`. Verificación: `npm run typecheck && npm run lint && npm run test`.
- [x] 3.4 Ídem para `useRepertoireTrainer` (incluye los valores `useMemo`/`useEffect` ya existentes en su retorno). Verificación: `npm run typecheck && npm run lint && npm run test`.

## 4. Optimización estructural de PianoKeyboard

- [x] 4.1 Precomputar `whiteKeys` y `blackKeys` con `useMemo(() => keys.filter(...), [keys])` y eliminar el `.filter()` inline en el `.map()` de teclas negras (PianoKeyboard.tsx:34 y :223-224). Verificación: `npm run typecheck`; el render mantiene el mismo conjunto y orden de teclas.
- [x] 4.2 Construir `pressedSet`, `stimulusSet`, `activeSet` con `useMemo` sobre sus props y reemplazar los `Array.includes` en `getKeyStyle` por `.has(note)`. Verificación: `npm run test` — las pruebas 1.3 de equivalencia visual pasan sin cambios.
- [x] 4.3 Extraer el subcomponente `PianoKey` envuelto en `React.memo`, con props estables (`note`, `isPressed`, `isStimulus`, `isActive`, `dotColor`/estilo precalculado, `disabled`, `onClick`, y layout de tecla negra), moviendo la lógica de estilo a la hoja. Conservar el estado `clickedNote` y el `setTimeout` en el padre pasando `isVirtualClicked` como prop. Verificación: `npm run test` — las pruebas 1.1, 1.2 y 1.3 pasan (Green).

## 5. Verificación final

- [x] 5.1 Ejecutar la verificación completa no interactiva: `npm run typecheck && npm run lint && npm run test`. Verificación: los tres comandos pasan limpios.
- [x] 5.2 Confirmar que el render del teclado se reduce: con tráfico MIDI simulado en las pruebas, ningún re-render ocurre cuando las props relevantes no cambian (pruebas 1.1/1.2 en Green). Verificación: `npm run test`.
