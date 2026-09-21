## Why

The Audit V6 remediation backlog (OLA 4.1) surfaced four independent hygiene and architecture defects that all degrade maintainability and, in one case, user-visible resilience. `App.tsx` carries 130 lines of inline MusicXML repertoire data that buries the component's real responsibility under static content (F10). The AI service is instantiated three separate times — in `useAiStore.ts`, `AnalyticsView.tsx` and `AiConsultationTab.tsx` — so three isolated `CircuitBreaker` instances track failure state independently; when LM Studio is down, the `OPEN` state is never shared and the user experiences redundant 15-minute retry windows across tabs (F4-02). `useMidi.ts` declares `stimulusTimersRef` as `Map<number, NodeJS.Timeout>` but indexes it with the composite string key `"1_60"` via a double cast `as unknown as number`, which defeats type safety on a MIDI timing hot path (F11, H-19). Finally, the `useMidi` test for `sendAllNotesOff` exception containment does not spy `console.warn`, so the intentional `[useMidi] Error al emitir MIDI Panic:` warning dumps a stack trace into the Vitest stderr on every run. This must be fixed now because OLA 4.1 is the last remediation wave before the audit closes, and each defect is cheap and self-contained.

## What Changes

- **Extract `DEFAULT_PARTITURA_XML` from `App.tsx` (F10)**: move the 130-line inline MusicXML constant into a new `src/renderer/src/domain/music/defaultScore.ts` module exporting `DEFAULT_PARTITURA_XML`, and import it in `App.tsx` so the root component holds only orchestration logic.
- **Unify the AI service into one shared singleton (F4-02)**: export `aiService = new LmStudioService()` from `src/renderer/src/domain/ai/lmStudioService.ts` and replace the three private `new LmStudioService()` instantiations in `useAiStore.ts`, `AnalyticsView.tsx` and `AiConsultationTab.tsx` with the shared import, so a single `CircuitBreaker` holds global failure state.
- **Strict typing of MIDI timer refs (F11, H-19)**: declare `stimulusTimersRef` as `useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())` to match the real composite `${channel}_${noteNumber}` key, declare `hungNotesTimersRef` as `useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())`, and delete every `as unknown as number` cast.
- **Test hygiene in `useMidi.test.ts`**: in the `sendAllNotesOff contiene las excepciones del puerto de salida` test, spy `console.warn` with `vi.spyOn(console, 'warn').mockImplementation(() => {})`, assert it was called with the MIDI Panic error message, and restore via `consoleSpy.mockRestore()`, so `npm run test` runs with zero stderr noise.
- **Full non-interactive verification**: `npm run typecheck && npm run lint && npm run test` must pass green with the full existing suite (394 tests) and no regressions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is an internal architecture refactor (SRP decoupling, singleton unification), type-correctness hardening and test hygiene. It alters no externally observable behavior and no spec-level requirement:

- The extracted `DEFAULT_PARTITURA_XML` is a byte-for-byte identical constant relocated to a domain module; `App.tsx` imports the same value.
- Spec `06-local-ai-integration` already mandates that `LmStudioService` be instantiated without arguments with the default `DEFAULT_APP_CONFIG.lmStudio` configuration; the shared `aiService` singleton is exactly that instance, now reused instead of triplicated. The `CircuitBreaker` contract (states, threshold, cooldown, suppression) is unchanged — only its instantiation count drops from three to one.
- Spec `01-midi-audio-hardware` already mandates that stimulus release be indexed by the composite key `${channel}_${noteNumber}`; the type change makes the declared type match that spec-mandated string key instead of laundering it through a numeric cast. MIDI Panic containment of `outputPort.send` exceptions is preserved.

Therefore this change declares `skip_specs: true`.

## Impact

- **Affected code**:
  - `src/renderer/src/App.tsx` (removal of the inline `DEFAULT_PARTITURA_XML` constant, added import).
  - `src/renderer/src/domain/music/defaultScore.ts` (new module; the relocated constant).
  - `src/renderer/src/domain/ai/lmStudioService.ts` (new exported `aiService` singleton).
  - `src/renderer/src/stores/useAiStore.ts`, `src/renderer/src/components/views/AnalyticsView.tsx`, `src/renderer/src/components/views/analytics/AiConsultationTab.tsx` (consume the shared singleton; drop local instantiation).
  - `src/renderer/src/hooks/useMidi.ts` (ref type declarations; removal of four `as unknown as number` casts).
  - `src/renderer/src/hooks/useMidi.test.ts` (`console.warn` spy in the exception-containment test).
- **APIs / dependencies**: No public API change. The exported surface of `LmStudioService` is unchanged; only a new named export `aiService` is added. No dependency additions or version bumps — everything uses existing TypeScript, React and Vitest primitives.
- **Systems**: Electron renderer process only. No main-process, preload, IPC, persistence, or MIDI-hardware-bridge changes. No changes to the 7 canonical specs.
- **Risk**: Behavioral equivalence must be preserved — the singleton must remain constructible with zero arguments for the existing `LmStudioService` unit tests, and the timer-ref retyping must not alter timer lookup/cancellation semantics (the composite key strings are unchanged in value, only in declared type). The `aiDecoupling.test.ts` contract (metric immutability under total AI failure) must remain green.
