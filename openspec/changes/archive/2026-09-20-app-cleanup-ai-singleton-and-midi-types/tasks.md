## 1. Higiene de testing (TDD — Red primero)

- [x] 1.1 En `src/renderer/src/hooks/useMidi.test.ts`, endurecer la prueba "sendAllNotesOff contiene las excepciones del puerto de salida": antes de invocar `sendAllNotesOff()`, espiar la advertencia con `const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})`. Verificación: `npm run test` — el espía silencia el stderr; la prueba aún pasa porque la contención de excepciones ya existe (este paso es de higiene, no Red).
- [x] 1.2 Añadir la aserción de contrato: `expect(consoleSpy).toHaveBeenCalledWith('[useMidi] Error al emitir MIDI Panic:', expect.any(Error))` y restaurar con `consoleSpy.mockRestore()` al final del cuerpo de la prueba. Verificación: `npm run test` — la prueba pasa, afirma que el warning del Pánico MIDI se emitió exactamente una vez con la etiqueta canónica, y la terminal de Vitest queda sin stack traces en stderr.

## 2. Tipado estricto de temporizadores MIDI (useMidi.ts)

- [x] 2.1 Retipar `stimulusTimersRef` con su tipo real: `useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())` (clave compuesta `${channel}_${noteNumber}`). Verificación: `npm run typecheck:web` — sin errores; la clave string ahora coincide con la spec `01-midi-audio-hardware`.
- [x] 2.2 Declarar `hungNotesTimersRef` coherentemente: `useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())` (clave `parsed.noteNumber`, sin cambios de comportamiento). Verificación: `npm run typecheck:web` — sin errores; reemplaza el tipo ambiente `NodeJS.Timeout` ajeno al renderer.
- [x] 2.3 Eliminar los cuatro dobles casts `as unknown as number` en `sendNote` (líneas 314, 315, 335 y 338), pasando `timerKey` directamente a `.has(...)`, `.get(...)`, `.delete(...)` y `.set(...)`. Verificación: `npm run typecheck:web` — compila sin casts; `npm run test` — las pruebas de cancelación en ráfaga y de Pánico MIDI siguen en verde (las claves runtime son idénticas, solo cambia el tipo declarado).

## 3. Desacoplamiento de App.tsx (SRP — F10)

- [x] 3.1 Crear `src/renderer/src/domain/music/defaultScore.ts` exportando la constante `DEFAULT_PARTITURA_XML` con el contenido MusicXML 4.0 idéntico (8 compases, "Partitura 1"), byte-for-byte. Verificación: el archivo existe y exporta la constante; `npm run typecheck` — sin errores.
- [x] 3.2 En `src/renderer/src/App.tsx`, eliminar la declaración inline de `DEFAULT_PARTITURA_XML` (líneas 37-166) e importarla desde `./domain/music/defaultScore`. Verificación: `npm run typecheck && npm run lint` — pasan; `npm run test` — las pruebas del trainer de repertorio y de `scoreParser` siguen parseando el mismo documento.

## 4. Singleton del servicio de IA (F4-02)

- [x] 4.1 En `src/renderer/src/domain/ai/lmStudioService.ts`, exportar la instancia singleton compartida: `export const aiService = new LmStudioService()` (instanciada sin argumentos, cumpliendo la spec `06-local-ai-integration`). Verificación: `npm run typecheck` — el nuevo named export compila; la clase `LmStudioService` sigue exportada para los tests que inyectan su propio `CircuitBreaker`.
- [x] 4.2 En `src/renderer/src/stores/useAiStore.ts`, eliminar `const aiService = new LmStudioService()` (línea 22) e importar `aiService` desde `../domain/ai/lmStudioService`. Verificación: `npm run typecheck && npm run lint` — pasan; `checkLmStudioStatus` y `runAiDiagnostic` usan la instancia compartida.
- [x] 4.3 En `src/renderer/src/components/views/AnalyticsView.tsx`, eliminar `const aiService = new LmStudioService()` (línea 32) e importar la instancia compartida. Verificación: `npm run typecheck && npm run lint` — pasan; la invocación a `askMultiSessionComparison` (línea 291) usa el singleton.
- [x] 4.4 En `src/renderer/src/components/views/analytics/AiConsultationTab.tsx`, eliminar `const aiService = new LmStudioService()` (línea 17) e importar la instancia compartida. Verificación: `npm run typecheck && npm run lint` — pasan; `askCustomConsultation` usa el singleton. Confirmar que solo queda una instancia de `LmStudioService` en código de aplicación: `Select-String -Pattern "new LmStudioService"` debe retornar solo la línea del singleton en `lmStudioService.ts`.

## 5. Verificación final

- [x] 5.1 Ejecutar la verificación completa no interactiva: `npm run typecheck && npm run lint && npm run test`. Verificación: los tres comandos pasan limpios; los 394 tests existentes permanecen en verde sin regresiones y con la consola completamente limpia (cero stderr inesperado).
- [x] 5.2 Confirmar el contrato de la spec `06-local-ai-integration`: `aiDecoupling.test.ts` (inmutabilidad de métricas ante fallo total de la IA) y las pruebas de `CircuitBreaker` pasan, probando que la unificación del singleton no altera la tolerancia a fallos. Verificación: `npm run test`.
- [x] 5.3 Confirmar el cero-cast en el dominio MIDI: `Select-String -Path "src/renderer/src/hooks/useMidi.ts" -Pattern "as unknown as number"` no retorna resultados. Verificación: salida vacía del comando.
