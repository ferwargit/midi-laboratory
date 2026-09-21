## Context

Four independent defects are being remediated in one OLA 4.1 wave. See `proposal.md` for the motivation and audit findings (F10, F4-02, F11, H-19, stderr hygiene).

Current state that shapes the approach:

1. **`App.tsx` (735 lines)** declares `DEFAULT_PARTITURA_XML` at module scope (lines 37-166): a 130-line MusicXML 4.0 template literal consumed by the repertoire trainer's score parser. The surrounding module already follows an import-oriented structure — `PIANO_KEYS`, `EMPTY_STIMULUS_NOTES` and `AppMode` are module-level constants, but those are genuinely render-related, whereas a repertoire score blob is static music-domain data. The `domain/music/` directory already hosts peer data modules (`presets.ts`, `sequences.ts`, `instruments.ts`, `scoreTypes.ts`), so a new `defaultScore.ts` follows the established organization.
2. **Three independent `LmStudioService` instances** exist as module-private constants: `useAiStore.ts:22`, `AnalyticsView.tsx:32` and `AiConsultationTab.tsx:17`. Each constructor call defaults to `new CircuitBreaker()` (see `lmStudioService.ts:23`), so three breakers track failure counts independently. Spec `06-local-ai-integration` requires the service be instantiated without arguments against `DEFAULT_APP_CONFIG.lmStudio` — all three already comply, they simply do not share state. `AnalyticsView` calls `askMultiSessionComparison` (line 291), `useAiStore` calls `analyzeAndPrescribe`/`checkConnection`, and `AiConsultationTab` calls `askCustomConsultation`: the three instances are used for disjoint operations, which is precisely why the split state goes unnoticed in unit tests.
3. **`useMidi.ts:70-71`** declares both timer refs as `Map<number, NodeJS.Timeout>`. `hungNotesTimersRef` is correctly keyed by `parsed.noteNumber` (number), but `stimulusTimersRef` is keyed by `timerKey = \`${channel}_${noteNumber}\``(string,`useMidi.ts:312`), accessed four times through `as unknown as number`(lines 314, 315, 335, 338). Spec`01-midi-audio-hardware`mandates the composite`${channel}_${noteNumber}`key, so the string is correct and the declared numeric type is the defect. Note`NodeJS.Timeout` is also the wrong ambient type in a renderer/browser context.
4. **`useMidi.test.ts:224-247`** asserts `sendAllNotesOff()` does not throw when `mockOutput.send` throws. The implementation logs `console.warn('[useMidi] Error al emitir MIDI Panic:', err)` (`useMidi.ts:134`); the test never spies it, so Vitest stderr receives the warning plus a stack trace on every run.

Constraints: Electron renderer process only; no new dependencies; no changes to the 7 canonical specs; the existing `LmStudioService` unit tests construct their own instances with custom circuit breakers, so the singleton must not become the only way to obtain a service.

## Goals / Non-Goals

**Goals:**

- Make `App.tsx` contain only orchestration logic by relocating static repertoire data to the music domain.
- Guarantee one process-wide `CircuitBreaker` for LM Studio so the `OPEN` state is shared across the diagnostic, consultation and comparison flows.
- Make `useMidi.ts` type-check honestly at the timer-ref layer with zero casts.
- Make `npm run test` produce zero unexpected stderr output from the MIDI Panic containment test, while strengthening that test into a real assertion.

**Non-Goals:**

- No change to the `LmStudioService` public API or the `CircuitBreaker` semantics (states, `failureThreshold: 3`, `cooldownPeriodMs: 30000`, suppression behavior) — only instantiation cardinality changes.
- No change to the MusicXML content itself; the constant is relocated byte-for-byte.
- No change to MIDI timing behavior: identical timer keys, identical cancellation and cleanup semantics.
- No dependency injection container, context provider or lazy-init factory for the AI service — a module-level singleton is sufficient for the renderer's single-window Electron model.
- No changes to the 7 canonical specs; this change declares `skip_specs: true`.

## Decisions

### D1: Relocate `DEFAULT_PARTITURA_XML` to `domain/music/defaultScore.ts`

Create `src/renderer/src/domain/music/defaultScore.ts` exporting the constant `DEFAULT_PARTITURA_XML` (the same template literal, unchanged content), and in `App.tsx` replace the inline declaration with `import { DEFAULT_PARTITURA_XML } from './domain/music/defaultScore'`.

**Rationale**: the value is immutable static repertoire data with no dependency on React or `App` state, so it is pure data and belongs in the domain layer beside `presets.ts` and `sequences.ts`. This is a mechanical move that reduces `App.tsx` by ~130 lines and makes the score reusable by any future consumer of `parseMusicXml` without importing the root component. Exporting a `const` keeps the string frozen at module scope, exactly as it is today.

**Alternative considered**: moving it into `scoreParser.ts` (the only current consumer's neighbor) — rejected because the parser is a pure function module and mixing a large data blob into it blurs the data/logic separation the `domain/music/` directory already achieves.

### D2: Export a shared `aiService` singleton from `lmStudioService.ts`

Add `export const aiService = new LmStudioService()` at the bottom of `src/renderer/src/domain/ai/lmStudioService.ts`. In `useAiStore.ts`, `AnalyticsView.tsx` and `AiConsultationTab.tsx`, delete the local `const aiService = new LmStudioService()` and import the shared `aiService` instead.

**Rationale**: the constructor already defaults to `DEFAULT_APP_CONFIG.lmStudio` and a fresh `CircuitBreaker` when called with no arguments, which is exactly what the spec mandates. A single module-level instance in the module that defines the class is the natural ownership point: it is the SSOT for the service just as `appConfig.ts` is the SSOT for configuration. Because ES module state is shared per renderer window, all three consumers now consult one breaker, so once it trips to `OPEN` the other two flows suppress immediately instead of re-attempting for another 15-minute timeout window. The class export is retained, so unit tests that need a custom `CircuitBreaker` continue to instantiate their own service — the singleton is the default for application code, not a constraint on test code.

**Alternative considered**: (a) A `createAiService()` factory with a lazily-initialized module cache — rejected as indirection with no benefit for a single-window Electron renderer. (b) A React Context provider — rejected because `useAiStore` is a Zustand store outside the React tree, so a context would not reach it without restructuring, and `AnalyticsView`/`AiConsultationTab` already import the service directly. (c) Passing one instance down through props from `App.tsx` — rejected because it threads a service through the component tree for no reason and would still miss the Zustand store.

### D3: Retype the timer refs with `ReturnType<typeof setTimeout>` and honest key types

In `useMidi.ts`, change:

- `const stimulusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())` — keyed by the composite `${channel}_${noteNumber}` string it actually uses.
- `const hungNotesTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())` — keyed by `parsed.noteNumber`, unchanged in behavior.

Then delete the four `as unknown as number` casts at the `.has(...)`, `.get(...)`, `.delete(...)` and `.set(...)` call sites in `sendNote`, passing `timerKey` directly.

**Rationale**: `ReturnType<typeof setTimeout>` resolves to the correct platform timer handle under the project's `tsconfig.web.json` DOM/lib settings, replacing the Node-ambient `NodeJS.Timeout` that does not belong in renderer code. Declaring the string key type makes the compiler verify, rather than assume, that every access uses the composite key — the spec-mandated indexing scheme. The runtime keys are identical strings, so lookup, cancellation and cleanup semantics are unchanged; only the type-level lie is removed. The non-null assertions (`!`) on `.get(...)` remain, guarded as they are today by preceding `.has(...)` checks.

**Alternative considered**: keeping `Map<number, ...>` and casting the key once at a single helper — rejected because it preserves the defect (a numeric map can never hold a `"1_60"` key honestly) and leaves the door open to new casts.

### D4: Spy `console.warn` in the MIDI Panic containment test

In the `sendAllNotesOff contiene las excepciones del puerto de salida` test, before invoking `sendAllNotesOff()`, add `const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})`. After the existing `not.toThrow()` assertion, add `expect(consoleSpy).toHaveBeenCalledWith('[useMidi] Error al emitir MIDI Panic:', expect.any(Error))`, then `consoleSpy.mockRestore()`.

**Rationale**: mocking the implementation silences the stderr output, and asserting the call upgrades the test from "does not crash" to "logs the expected diagnostic for the right reason" — the containment contract in spec `01-midi-audio-hardware` (step 7: exceptions MUST be contained and not propagated) is now verified on both axes. `mockRestore()` in the same test guarantees no spy leaks into neighboring tests, which matters because `useMidi.test.ts` runs several tests in one file. Using `expect.any(Error)` rather than matching the message text of the thrown error keeps the assertion robust against unrelated wording in the mock's thrown message while still pinning the warning label.

**Alternative considered**: a file-level `beforeEach`/`afterEach` spy — rejected as over-broad: it would silence every legitimate warning in the file and weaken the per-test assertion this change is meant to add.

## Risks / Trade-offs

- **[Singleton retards test isolation]** → A module-level `aiService` holds `CircuitBreaker` state across tests that import it. Mitigation: the three consumers' existing tests operate on their own behavior; if a future test imports `aiService` directly it must reset the breaker. The existing `LmStudioService` unit tests construct isolated instances with custom breakers and are unaffected because the class export is retained.
- **[Import cycle risk in D2]** → `lmStudioService.ts` exporting an instance does not create a cycle, since the instance is created inside the module that owns the class; consumers import the value, they do not feed anything back. Mitigation: `npm run typecheck` and `npm run lint` will surface any cycle-related issue; the import graph is verified by the full test run.
- **[Type change alters no runtime behavior]** → Retyping a `Map` cannot change behavior, but a key typed `string` could invite a typo'd key that silently never collides. Mitigation: the key is computed in exactly one place (`const timerKey = \`${channel}_${noteNumber}\``) and consumed at four adjacent call sites in the same `useCallback`; the existing burst-cancellation test (`sendNote cancela temporizadores previos...`) and the MIDI Panic tests pin the semantics.
- **[`NodeJS.Timeout` removal may expose other ambient usages]** → If another renderer module relies on the same ambient type it is unaffected (this change touches only `useMidi.ts`). Mitigation: `npm run typecheck:web` is the authoritative check and is part of the verification gate.
- **[Spy not restored on early assertion failure]** → If `expect(consoleSpy).toHaveBeenCalledWith(...)` fails, `mockRestore()` never runs and the spy could leak within the file. Mitigation: acceptable in a single-run Vitest process where the module is re-imported per file; the assertion order (spy → call → assert → restore) keeps the happy path clean, and a failing assertion is itself the signal to fix the test.
- **[Behavioral drift risk in the extracted MusicXML]** → A botched relocation could truncate the score and change repertoire rendering. Mitigation: the constant is moved verbatim; the repertoire trainer tests plus `npm run test` verify the parser still receives the identical document.

## Migration Plan

1. Land D1 (`defaultScore.ts` + `App.tsx` import) — pure data move, no logic; run `npm run typecheck && npm run test`.
2. Land D2 (singleton export + three consumer switches) — one module added export, three modules edited; run `npm run typecheck && npm run lint && npm run test`, confirming `aiDecoupling.test.ts` stays green.
3. Land D3 (timer ref retyping + cast removal) — single-file type change; run `npm run typecheck` first (this is where compiler feedback is immediate) then `npm run test` for the timer semantics.
4. Land D4 (`console.warn` spy) — test-only change; run `npm run test` and confirm the MIDI Panic test passes and stderr is clean.
5. Rollback strategy: each decision is a discrete, independently revertible commit; none changes any public interface or spec, so no downstream migration is required. If the singleton surfaces an unforeseen test-ordering issue, reverting D2 alone restores the three independent breakers without touching D1/D3/D4.

## Open Questions

None — all four decisions are self-contained within the renderer layer, preserve observable behavior, and do not alter specs, APIs or the task breakdown.
