# Design

## Context

El hot-path MIDI concentra el estado de telemetría de alta frecuencia en el componente raíz:

- `useMidi` mantiene `logs` como `useState` (`useMidi.ts:69`) y `addLog` hace `setLogs` con append + `slice(-35)` (`useMidi.ts:92-103`). Como el hook vive en `App` (`App.tsx:53`), cada evento de log re-renderiza `App` y reconcilia el árbol completo (F12.1).
- `App.tsx:592` pasa `logs={midi.logs}` (array fresco en cada render) y `onOpenResetModal={(): void => setIsResetModalOpen(true)}` (arrow inline) a `StudioBottomDock`, cuyo `React.memo` (`StudioBottomDock.tsx:210`) nunca cortocircuita (F12.2).
- Consumidores reales del buffer (verificados por grep): el badge de conteo `Telemetría ({logs.length})` de la barra permanente del dock (`StudioBottomDock.tsx:190`) y `MidiMonitor` (`StudioBottomDock.tsx:203`, montado solo con el drawer abierto; renderiza la lista y hace scroll en cada cambio, `MidiMonitor.tsx:11-13`).
- El proyecto ya usa zustand como idioma de stores (`stores/useAiStore.ts`, `useAnalyticsStore.ts`, `useDatabaseStore.ts`) y `s3-render-performance.test.tsx` establece los patrones de test de render (contadores de render con wrappers spy, `s3-render-performance.test.tsx:57-78`).
- Contrato actual verificado: ni el pánico ni el reset de DB limpian el historial de logs; la única semántica de expulsión es la ventana deslizante de 35. La refactorización es preservadora del comportamiento.

## Goals / Non-Goals

**Goals:**

- El buffer de telemetría deja de ser estado de React del hook/componente raíz: pasa a un store dedicado fuera del ciclo de render de `App`.
- Un evento de log NO re-renderiza `App` ni el árbol; solo re-renderizan los suscriptores hoja (badge de conteo, `MidiMonitor`).
- `StudioBottomDock` recupera su memoización efectiva: props de identidad estable y cero dependencia del buffer.
- Contrato funcional de telemetría intacto (tipado, formato, id único, ventana de 35).
- Suite completa, `typecheck` y `lint` en verde.

**Non-Goals:**

- No se abordan F12.3 (cascada de memoización por objetos literales frescos en `useMidi`/`useTrainerCore`) ni F12.4 (`activeStimulusNotes` en modo blind) — cambios posteriores.
- No se cambia la secuencia canónica del pánico ni el comportamiento de `sendAllNotesOff`.
- No se añade limpieza de logs en pánico/reinicio (el contrato actual no la tiene; preservación estricta).
- No se toca `StudioTopBar` ni las vistas (no consumen logs).

## Decisions

### D1 — Store de telemetría zustand dedicado (`stores/useTelemetryStore.ts`)

Nuevo store zustand con estado `{ logs: MidiLogEntry[] }` y acción `addLog(entry: Omit<MidiLogEntry, 'id' | 'time'>): void` que genera el sello temporal `HH:MM:SS.mmm` y el id único (`Date.now() + Math.random()`, misma fórmula actual), hace append y recorta a 35.

- **Por qué zustand y no `useSyncExternalStore` artesanal:** es el idioma establecido del proyecto (tres stores existentes), resuelve la suscripción selectiva con inmutabilidad por referencia y evita reimplementar la infraestructura de suscripción. Los selectores de zustand (`useTelemetryStore((s) => s.logs)`, `useTelemetryStore((s) => s.logs.length)`) dan la granularidad exacta: el badge se suscribe al número, el monitor al array.
- **Alternativa descartada:** store artesanal con `useSyncExternalStore`. Funcionalmente equivalente, pero introduce un segundo patrón de store externo en el codebase sin beneficio adicional.
- **Nota de rendimiento:** `addLog` se invoca desde el handler de `midimessage` (hot-path). La escritura zustand es O(1) con slice de 35; los re-renders quedan confinados a los suscriptores hoja.

### D2 — `useMidi` delega `addLog` y deja de exponer el buffer

El hook elimina `const [logs, setLogs] = useState` y su `addLog` pasa a delegar en `useTelemetryStore.getState().addLog(entry)` (vía `getState()` para no suscribir el hook al buffer). `UseMidiReturn` elimina `logs` (**BREAKING interno**); `addLog` se conserva en la API para que los ~12 call sites de `App.tsx` y trainers no cambien. `MidiLogEntry` se traslada a `stores/useTelemetryStore.ts` y `useMidi.ts` lo re-exporta (`export type { MidiLogEntry }`) para no romper los imports existentes del dock y del monitor durante la transición.

- **Por qué:** mantener `logs` en el retorno del hook obligaría al hook (y por tanto a `App`) a suscribirse al buffer, re-renderizando el árbol en cada evento — exactamente el defecto F12.1.
- **Alternativa descartada:** mantener `logs` en `UseMidiReturn` respaldado por el store. Rechazada: el hook seguiría re-renderizando por evento de log.
- **Detalle de import:** la dirección de dependencia queda `useMidi → store` (unidireccional); el tipo vive en el store para evitar el ciclo `store → hook → store`.

### D3 — Badge de conteo aislado + `MidiMonitor` autosuscrito

- El `<span>Telemetría ({logs.length})</span>` de la barra permanente se extrae a un componente memoizado `TelemetryCountBadge` que se suscribe con el selector `useTelemetryStore((s) => s.logs.length)` (número primitivo: re-render solo cuando cambia el conteo). El botón contenedor permanece en el dock con su `onClick` de toggle.
- `MidiMonitor` elimina la prop `logs` y se suscribe internamente al array completo. Su `useEffect` de scroll (`MidiMonitor.tsx:11-13`) se mantiene con la misma dependencia efectiva (el array del store).
- **Por qué extraer el badge:** el criterio de verificación exige que el dock NO re-renderice con el drawer cerrado; si el dock se suscribiera al conteo directamente, re-renderizaría en cada evento (el número cambia en cada append hasta el cap). El badge hoja absorbe ese re-render.

### D4 — Props estables del dock en `App.tsx`

`handleOpenResetModal = useCallback((): void => setIsResetModalOpen(true), [])` y `<StudioBottomDock onOpenResetModal={handleOpenResetModal} />` (sin prop `logs`). Con props estables, el `React.memo` del dock cortocircuita ante los re-renders de `App` provocados por otros estados (notas pulsadas, trainers).

- **Alternativa descartada:** mover `isResetModalOpen` a un store. Rechazada: amplía el alcance (el modal y sus atajos dependen de ese estado) sin ser necesaria para F12.2.

### D5 — Estrategia de pruebas de render

- **F12.1 (hook):** en `useMidi.test.ts`, `renderHook` con contador de renders en el callback (`let renders = 0; renderHook(() => { renders++; return useMidi() })`); tras `act(() => result.current.addLog(...))`, `renders` NO aumenta. Test adicional: la ventana de 35 se verifica contra `useTelemetryStore.getState().logs`.
- **F12.2 (dock):** detector de renders del impl del dock mediante un contador de invocaciones al hook `useDatabaseStore` (el impl lo llama 3 veces por render: `summary`, `exportBackupJson`, `importBackupJson`), instalado con `vi.mock` + `importOriginal` envolviendo el hook con un contador. Este mecanismo detecta TODOS los renders del impl — los provocados desde el padre (props) y los internos (cambio de estado `isOpen`, o hipotéticas suscripciones propias al store de telemetría) — a diferencia de un wrapper-spy externo, que solo vería los renders provocados desde el padre. El test incluye un control que valida el detector: una prop inestable fuerza el fallo de la memoización (+3 invocaciones al hook). Test complementario a nivel `App` (`App.test.tsx`): un stub del dock captura la identidad de `onOpenResetModal` en cada render del componente raíz y afirma que la referencia es invariable (protege contra regresiones a arrow inline).
- **Limpieza entre tests:** los tests del store deben resetear el estado entre casos (`useTelemetryStore.setState({ logs: [] })` en `beforeEach`) para evitar contaminación cruzada por el orden de ejecución.

## Risks / Trade-offs

- **[Riesgo] Cambio de API interna del hook (`UseMidiReturn` sin `logs`).** Cualquier consumidor futuro que espere `midi.logs` fallará en compile-time (typecheck lo detecta). → _Mitigación:_ `typecheck` + suite completa en verde; el tipo `MidiLogEntry` sigue exportándose desde `useMidi.ts` por compatibilidad.
- **[Riesgo] El badge de conteo re-renderiza en cada evento hasta alcanzar el cap de 35.** Es el comportamiento deseado (el número mostrado cambia), pero confinado a un nodo hoja de coste mínimo. → _Mitigación:_ componente memoizado con selector primitivo; a partir del cap (35 entradas), el selector `s.logs.length` deja de cambiar y el badge deja de re-renderizar.
- **[Trade-off] Dos fuentes de estado de telemetría aparentes** (el store y el hook que delega). La delegación por `getState()` mantiene un único propietario real (el store); el hook es solo una fachada de escritura para los call sites existentes.
- **[Trade-off] `MidiMonitor` pierde su prop explícita** y acopla su render al store. Es el patrón zustand idiomático del proyecto (los componentes leen de stores directamente); el acoplamiento es a la capacidad de telemetría, no a un componente padre.

## Migration Plan

Refactor interno del renderer en un solo commit lógico: store nuevo → hook delega → dock/monitor se suscriben → App estabiliza props → tests. Sin migración de datos (el buffer es efímero, en memoria). Rollback trivial (revert). Sin despliegue especial.

## Open Questions

(ninguna)
