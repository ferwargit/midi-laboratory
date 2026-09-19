## 1. Configuración SSOT (appConfig)

- [x] 1.1 Añadir `autoAdvanceSmartDelayMs: number` a la interfaz `MidiConfig` en `src/renderer/src/domain/ai/appConfig.ts` — verificar con `npm run typecheck` que no hay errores de tipo.
- [x] 1.2 Definir `autoAdvanceSmartDelayMs: 1500` en `DEFAULT_APP_CONFIG.midi` — verificar que `DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs === 1500` (cubre la aserción de la tarea 4.1).

## 2. Kernel de sesión (useTrainerCore)

- [x] 2.1 Añadir `autoAdvanceSmartDelayMs?: number` a la interfaz `TrainerCoreOptions` en `src/renderer/src/hooks/useTrainerCore.ts`.
- [x] 2.2 Añadir el parámetro desestructurado `autoAdvanceSmartDelayMs = DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs` en la lista de parámetros del hook (junto a `autoAdvanceFastDelayMs`/`autoAdvanceSlowDelayMs`) — verificar con `npm run typecheck`.
- [x] 2.3 Reemplazar el ternario de retardo en `recordAnswer` (`mode === 'auto_slow' ? autoAdvanceSlowDelayMs : autoAdvanceFastDelayMs`) por la selección explícita por modo: `'auto_slow'` → `autoAdvanceSlowDelayMs`, `'auto_fast'` → `autoAdvanceFastDelayMs`, `'smart'` → `autoAdvanceSmartDelayMs`.
- [x] 2.4 Añadir `autoAdvanceSmartDelayMs` al arreglo de dependencias del `useCallback` de `recordAnswer` — verificar que un override de la opción toma efecto (caso de prueba 4.3).

## 3. Deltas y especificaciones canónicas

- [x] 3.1 Confirmar que la delta `openspec/changes/decouple-smart-advance-delay/specs/02-trainer-core-engine/spec.md` contiene el `## MODIFIED Requirements` del requisito "Modos de Avance (AdvanceMode)" con la tabla y la regla de selección actualizadas — verificar con `openspec validate decouple-smart-advance-delay --strict`.
- [x] 3.2 Editar directamente `openspec/specs/02-trainer-core-engine/spec.md`: en la lista SSOT de la sección `## Purpose`, cambiar "`autoAdvanceFastDelayMs = 1500` (modos `smart` y `auto_fast`)" por dos entradas: "`autoAdvanceFastDelayMs = 1500` (modo `auto_fast`)" y "`autoAdvanceSmartDelayMs = 1500` (modo `smart`)".
- [x] 3.3 Editar directamente `openspec/specs/01-midi-audio-hardware/spec.md`: añadir la fila `| autoAdvanceSmartDelayMs | 1500 | Auto-avance del modo smart |` a la tabla SSOT de la sección `## Purpose`, manteniendo el orden y las columnas existentes.
- [x] 3.4 Releer ambas specs canónicas editadas y confirmar que no quedó ninguna referencia a que `smart` usa `autoAdvanceFastDelayMs` — verificar con una búsqueda de `autoAdvanceFastDelayMs` en `openspec/specs/`.

## 4. Pruebas

- [x] 4.1 En `src/renderer/src/domain/ai/appConfig.test.ts`: añadir aserción `expect(DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs).toBe(1500)` al caso canónico existente — verificar con `npm run test`.
- [x] 4.2 En `src/renderer/src/hooks/useTrainerCore.test.ts`: añadir un caso que renderice el hook con `defaultAdvanceMode: 'smart'` y compruebe que con el default (1500 ms) el avance se programa al pasar 1600 ms (preserva la conducta actual).
- [x] 4.3 En `src/renderer/src/hooks/useTrainerCore.test.ts`: añadir un caso con `vi.useFakeTimers()` que renderice el hook en modo `'smart'` con `autoAdvanceSmartDelayMs: 1200` y registre una respuesta correcta — verificar que a los 1100 ms `onAdvanceTrigger` no se disparó y a los 1300 ms se disparó una vez.
- [x] 4.4 En `src/renderer/src/hooks/useTrainerCore.test.ts`: añadir (o extender el caso 4.3 con) una aserción que demuestre que el override de `autoAdvanceSmartDelayMs: 1200` no altera el retardo de `'auto_fast'` — p. ej. un segundo hook en modo `'auto_fast'` con el mismo override que siga disparando a los 1600 ms y no a los 1300 ms.

## 5. Verificación final

- [x] 5.1 Ejecutar `npm run typecheck` y confirmar salida sin errores.
- [x] 5.2 Ejecutar `npm run test` (vitest) y confirmar que todos los casos, incluidos los nuevos, pasan.
- [x] 5.3 Ejecutar `openspec validate decouple-smart-advance-delay --strict` y confirmar "Change 'decouple-smart-advance-delay' is valid".
