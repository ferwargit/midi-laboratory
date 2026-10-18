# Tasks

## 1. Store de telemetría dedicado

- [x] 1.1 Crear `src/renderer/src/stores/useTelemetryStore.ts` (zustand, patrón de los stores existentes): estado `{ logs: MidiLogEntry[] }`, acción `addLog(entry: Omit<MidiLogEntry, 'id' | 'time'>)` que genera el sello temporal `HH:MM:SS.mmm` y el id único (`Date.now() + Math.random()`), hace append y recorta a 35 entradas; trasladar la interfaz `MidiLogEntry` a este módulo. Verificar: `npm run typecheck` sin errores nuevos.
- [x] 1.2 Tests unitarios del contrato en `src/renderer/src/stores/useTelemetryStore.test.ts` (con reset del store en `beforeEach`): formato y tipado preservados, identificadores únicos en entradas consecutivas, ventana deslizante de 35 (40 entradas → 35, última = entrada 40). Verificar: `npx vitest run src/renderer/src/stores/useTelemetryStore.test.ts` en verde.

## 2. Desacople del hook useMidi (F12.1)

- [x] 2.1 Test (Red): en `useMidi.test.ts`, `renderHook` con contador de renders en el callback del hook; afirmar que invocar `addLog` NO re-renderiza al consumidor del hook. Verificar: el test falla contra la implementación actual (Red) y pasa tras 2.3 (Green).
- [x] 2.2 Test (Red): actualizar el test de ventana deslizante de `useMidi.test.ts` para leer el buffer desde `useTelemetryStore.getState().logs` (con reset del store en `beforeEach`). Verificar: el test falla contra la implementación actual (Red) y pasa tras 2.3 (Green).
- [x] 2.3 Implementar la delegación en `src/renderer/src/hooks/useMidi.ts`: eliminar el estado `logs`, delegar `addLog` en `useTelemetryStore.getState().addLog(...)` (sin suscribir el hook al buffer), eliminar `logs` de `UseMidiReturn` y del objeto retornado, y re-exportar `MidiLogEntry` desde `useMidi.ts` por compatibilidad de imports. Verificar: tests 2.1 y 2.2 en Green y `npx vitest run src/renderer/src/hooks/useMidi.test.ts` en verde.

## 3. Suscripción directa de consumidores y props estables (F12.2)

- [x] 3.1 Test (Red): en un nuevo `src/renderer/src/components/trainer/StudioBottomDock.test.tsx`, aislar el cuerpo del dock — con el badge de conteo aislado del árbol bajo test y el drawer cerrado, añadir entradas al store de telemetría y re-renderizar el padre con props estables NO re-renderiza el impl del dock (detector de renders: contador de invocaciones al hook `useDatabaseStore` del impl, 3 por render, instalado con `vi.mock` + `importOriginal`; detecta renders internos y por props). Verificar: el test falla contra la implementación actual (Red) y pasa tras 3.4 (Green).
- [x] 3.2 Test (Red): suscripción del badge — con el dock real montado sin prop `logs`, añadir entradas al store actualiza el texto `Telemetría (N)` de la barra permanente. Verificar: el test falla contra la implementación actual (Red) y pasa tras 3.4 (Green).
- [x] 3.3 Test (Red): suscripción del monitor — con el drawer abierto, añadir una entrada al store hace que `MidiMonitor` muestre la nueva entrada sin recibir prop `logs`. Verificar: el test falla contra la implementación actual (Red) y pasa tras 3.4 (Green).
- [x] 3.4 Implementar la suscripción directa y las props estables: extraer `TelemetryCountBadge` memoizado con selector `(s) => s.logs.length` en `StudioBottomDock.tsx`; actualizar `StudioBottomDockProps` sin `logs`; `MidiMonitor.tsx` se suscribe al store y elimina la prop `logs`; en `App.tsx`, `handleOpenResetModal = useCallback((): void => setIsResetModalOpen(true), [])` y `<StudioBottomDock onOpenResetModal={handleOpenResetModal} />`. Verificar: tests 3.1-3.3 en Green y suites de dock/monitor en verde.

## 4. Verificación integral

- [x] 4.1 Ejecutar la suite completa `npm test` y confirmar 0 fallos. Verificar: salida de Vitest sin tests fallidos ni errores no capturados.
- [x] 4.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar 0 errores. Verificar: ambos comandos terminan con código de salida 0.
- [x] 4.3 Ejecutar el formateo del proyecto (Prettier) sobre los archivos modificados. Verificar: `git diff` posterior no muestra re-formateos pendientes.
