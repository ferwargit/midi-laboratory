# Capability: Adaptive Selection Algorithms & Spaced Repetition

## Purpose

Esta capacidad define el **motor de selección adaptativa de estímulos** de `midi-laboratory`: implementa el patrón **Strategy** sobre la interfaz común `ExerciseSelectionStrategy`, de forma que la política de elección de la próxima nota es intercambiable en tiempo de ejecución sin acoplar la lógica de sesión a un algoritmo concreto.

Las tres estrategias conviven tras un único contrato y se instancian por identificador mediante la fábrica `createStrategy`. La estrategia es **plug-in puro de dominio**: no mantiene estado de sesión ni de React; toda la información que necesita entra por el contexto inmutable `SelectionContext` y toda su decisión sale por el valor `SelectionDecision`, lo que la hace deterministamente testeable y auditable.

| Frente     | Unidad canónica                                                                  | Responsabilidad                                                                                       |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Contrato   | `domain/adaptation/types.ts`                                                     | `StrategyId`, `ExerciseSelectionStrategy`, `SelectionContext`, `SelectionDecision`, `NotePerformance` |
| Aleatoria  | `domain/adaptation/adaptiveEngine.ts` → `RandomSelectionStrategy`                | Probabilidad uniforme pura                                                                            |
| Adaptativa | `domain/adaptation/adaptiveEngine.ts` → `AdaptiveV1SelectionStrategy`            | Ponderación por errores, recurrencia y matriz de confusión                                            |
| Espaciada  | `domain/adaptation/spacedRepetitionEngine.ts` → `SpacedRepetitionStrategy`       | Cajas de memoria Leitner con vencimientos                                                             |
| Fábrica    | `domain/adaptation/adaptiveEngine.ts` → `createStrategy`, `AVAILABLE_STRATEGIES` | Instanciación y registro seleccionable                                                                |

**Consumidor principal verificado:** la Modalidad 01 (`hooks/useSingleNoteTrainer.ts`) instancia `createStrategy(selectedStrategyId)`.

**Alcance (in-scope):** contrato de interfaz, fábrica y registro, las tres estrategias de selección (pesos, matriz de confusión, ruleta, cajas Leitner, vencimientos, degradación), cálculo de desempeño y telemetría de inspección.

**Fuera de alcance (out-of-scope):** máquina de estados (Módulo 02); evaluación musical (Módulo 03); hardware MIDI (Módulo 01); analítica e IA.

## Requirements

### Requirement: Contrato de Interfaz Común (ExerciseSelectionStrategy)

Toda estrategia de selección MUST (DEBE) implementar la interfaz `ExerciseSelectionStrategy`, cumpliendo exactamente su firma y su modelo de datos.

- `StrategyId` MUST ser la unión `'random' | 'adaptive_v1' | 'spaced_repetition'`.
- La interfaz MUST exponer tres miembros de solo lectura: `id: StrategyId`, `name: string` y `description: string`.
- `selectNextNote(context: SelectionContext): SelectionDecision` es el método canónico de selección.
- `getNotePerformances(activeNotes, history): Map<number, NotePerformance>` MUST devolver una entrada por cada nota activa con `noteNumber`, `attempts`, `correct`, `lastResultWasCorrect`, `accuracyPercentage` y `weight`.
- `SelectionDecision` MUST entregar `selectedNote: number`, una cadena `reason` y un `weightsSnapshot: Record<string, number>` indexado por nombre científico de nota (ej. `'C4'`).
- Las estrategias MUST NOT mantener estado mutable entre invocaciones.

#### Scenario: Tres estrategias implementan el mismo contrato

- **GIVEN** los identificadores `'random'`, `'adaptive_v1'` y `'spaced_repetition'`
- **WHEN** se instancian por la fábrica `createStrategy`
- **THEN** las tres cumplen `ExerciseSelectionStrategy`, exponen su `id` respectivo y responden a `selectNextNote` y `getNotePerformances`

#### Scenario: Desempeño por nota con historial vacío

- **GIVEN** una estrategia cualquiera y `activeNotes = [60, 62]`
- **WHEN** se invoca `getNotePerformances` con `history = []`
- **THEN** el `Map` tiene exactamente 2 entradas con `attempts === 0`, `correct === 0`, `lastResultWasCorrect === null` y `accuracyPercentage === 0`

### Requirement: Comportamiento de Borde Común y Anti-Repetición Inmediata

Las tres estrategias MUST (DEBE) compartir las mismas reglas de borde y el mismo filtro de anti-repetición.

- Con `activeNotes` vacío, `selectNextNote` MUST lanzar un error que coincide con `/no hay notas/i`.
- Con exactamente una nota activa, `selectNextNote` MUST devolver esa nota sin ruleta, con `weightsSnapshot = { <nombre>: 1.0 }`.
- El filtro de anti-repetición MUST activarse solo cuando `activeNotes.length >= 3` y `lastPlayedNote !== null`, eliminando `lastPlayedNote` de los candidatos.
- Con pools de 2 notas o sin `lastPlayedNote`, el conjunto de candidatos MUST ser el pool completo.
- El `weightsSnapshot` devuelto MUST cubrir todas las notas activas.

#### Scenario: Pool vacío es rechazado

- **GIVEN** cualquier estrategia con `activeNotes = []`
- **WHEN** se invoca `selectNextNote`
- **THEN** se lanza un error que coincide con `/no hay notas/i`

#### Scenario: Pool de una nota no entra a la ruleta

- **GIVEN** cualquier estrategia con `activeNotes = [60]` y `lastPlayedNote = null`
- **WHEN** se invoca `selectNextNote`
- **THEN** `selectedNote === 60`, `reason` indica única nota disponible y `weightsSnapshot['C4'] === 1.0`

#### Scenario: Anti-repetición respetada con 3 o más notas

- **GIVEN** cualquier estrategia con `activeNotes = [60, 62, 64]` y `lastPlayedNote = 60`
- **WHEN** se invoca `selectNextNote` repetidamente (20 veces)
- **THEN** `selectedNote` nunca es `60`

#### Scenario: Anti-repetición desactivada con 2 notas

- **GIVEN** cualquier estrategia con `activeNotes = [60, 64]` y `lastPlayedNote = 60`
- **WHEN** se invoca `selectNextNote`
- **THEN** `60` es un candidato legítimo

### Requirement: Distribución Uniforme Pura (RandomSelectionStrategy)

`RandomSelectionStrategy` MUST (DEBE) ofrecer probabilidad estrictamente uniforme entre las notas activas, sin ningún sesgo de desempeño.

- `id` MUST ser `'random'`; `name` MUST ser `'Aleatorio Clásico'`.
- La selección MUST muestrear uniformemente entre los candidatos post-anti-repetición.
- El `weightsSnapshot` MUST asignar peso idéntico `1.0` a todas las notas activas.
- `getNotePerformances` MUST devolver `weight === 1.0` en todas las entradas.
- La `reason` MUST ser `'Selección uniforme aleatoria'`.

#### Scenario: Selección siempre dentro del pool

- **GIVEN** `RandomSelectionStrategy` con `activeNotes = [60, 62, 64]` y `history = []`
- **WHEN** se invoca `selectNextNote`
- **THEN** `selectedNote ∈ [60, 62, 64]` y `reason` está definida

#### Scenario: Pesos uniformes en el snapshot

- **GIVEN** `RandomSelectionStrategy` con `activeNotes = [60, 62]`
- **WHEN** se invoca `selectNextNote`
- **THEN** `weightsSnapshot['C4'] === 1.0` y `weightsSnapshot['D4'] === 1.0`

### Requirement: Ponderación por Errores Recientes (AdaptiveV1SelectionStrategy)

`AdaptiveV1SelectionStrategy` MUST (DEBE) aumentar el peso de una nota a medida que cae su precisión histórica, priorizando el refuerzo de notas débiles.

- `id` MUST ser `'adaptive_v1'`; `name` MUST ser `'Adaptativo Inteligente (v1)'`.
- Para notas con `attempts > 0`, el peso base MUST crecer según `weight = 1.0 + errorRate * 2.5`, donde `errorRate = 1 - accuracyPercentage / 100`.
- Si además `lastResultWasCorrect === false`, MUST sumarse un bonus de `+2.0`.
- Si la nota está dominada (`accuracyPercentage >= 85` y `attempts >= 3`), el peso MUST reducirse a `0.3`.
- El peso final MUST tener un piso de `Math.max(0.2, weight)`.
- Las notas con `attempts === 0` MUST conservar el peso base `1.0`.

#### Scenario: Nota fallada pesa más que nota correcta

- **GIVEN** `AdaptiveV1SelectionStrategy`, `activeNotes = [60, 64]` y un historial donde `60` fue acertada y `64` fallada
- **WHEN** se invoca `getNotePerformances`
- **THEN** la precisión de `60` es 100, la de `64` es 0 y `weight(64) > weight(60)`

#### Scenario: Bonus por fallo reciente

- **GIVEN** una nota con un único intento fallido
- **WHEN** se calcula su peso
- **THEN** este es `1.0 + (1.0 * 2.5) + 2.0 = 5.5`

#### Scenario: Nota dominada reduce su peso

- **GIVEN** una nota con 3 aciertos de 3 intentos
- **WHEN** se calcula su peso
- **THEN** este es `0.3`

### Requirement: Matriz de Confusión Psicoacústica Real (AdaptiveV1SelectionStrategy)

El motor MUST (DEBE) registrar el par ordenado `(nota_esperada, nota_tocada)` en cada fallo y aplicar un bonus de peso solo ante recurrencia estricta del mismo par.

- Por cada respuesta incorrecta cuyo `expectedNote` esté en el pool, MUST registrarse la clave de par `${expectedNote}_${playedNote}` e incrementarse su contador.
- Cuando un par ordenado alcance `>= 2` ocurrencias, MUST marcarse como confusión recurrente y ambas notas del par reciben `+1.5` de peso.
- Un único error aislado sobre un par (`count === 1`) MUST NOT recibir el bonus de confusión recurrente.
- El bonus de confusión MUST sumarse después del cálculo base y de la reducción por nota dominada.

#### Scenario: Un solo error aislado no recibe bonus de confusión

- **GIVEN** `activeNotes = [60, 62, 64]` y un historial con un único fallo `60 → 62` seguido de un acierto en `60`
- **WHEN** se invoca `getNotePerformances`
- **THEN** `weight(62) === 1.0` (sin bonus de confusión)

#### Scenario: Par recurrente recibe el bonus a ambas notas

- **GIVEN** `activeNotes = [60, 62, 64]` y un historial con dos fallos idénticos `60 → 62`
- **WHEN** se invoca `getNotePerformances`
- **THEN** `weight(62) >= 2.5` y `weight(60)` incluye también el `+1.5`

### Requirement: Ruleta Probabilística Ponderada y Razón Explicativa (AdaptiveV1SelectionStrategy)

La selección MUST (DEBE) implementar una ruleta de pesos acumulados sobre los candidatos y producir una razón pedagógica interpretable.

- `weightsSnapshot` MUST redondear cada peso a 1 decimal para legibilidad.
- El total de la ruleta MUST ser la suma de pesos de los candidatos; el umbral es `Math.random() * totalWeight`.
- El recorrido de la ruleta MUST comenzar desde el primer candidato, restando el peso al umbral hasta que `threshold <= weight`, cayendo por defecto en el último candidato.
- La `reason` MUST clasificarse según el desempeño: `'Exploración inicial'`, refuerzo de fallo reciente, tasa de error alta, mantenimiento de nota dominada o entrenamiento en progreso.

#### Scenario: Snapshot de pesos por nota disponible para depuración

- **GIVEN** `AdaptiveV1SelectionStrategy`, `activeNotes = [60, 62]` y `history = []`
- **WHEN** se invoca `selectNextNote`
- **THEN** `weightsSnapshot` está definido con `weightsSnapshot['C4'] === 1.0` y `weightsSnapshot['D4'] === 1.0`

#### Scenario: Convergencia hacia las notas débiles

- **GIVEN** una simulación de 50 ejercicios sobre `activeNotes = [60, 62, 64, 65, 67]` donde se falla sistemáticamente la nota `67`
- **WHEN** se cuenta la frecuencia de cada nota esperada
- **THEN** los intentos sobre `67` son mayores que los de una nota correcta como `60`

### Requirement: Modelo de 3 Cajas de Memoria Leitner (SpacedRepetitionStrategy)

`SpacedRepetitionStrategy` MUST (DEBE) organizar cada nota activa en un estado `LeitnerItemState` con tres cajas de memoria y reglas de promoción deterministas.

- El estado MUST contener `{ item, box: 1 | 2 | 3, consecutiveCorrect, lastAskedIndex, dueDistance }`.
- Al inicializarse, todas las notas MUST arrancar en `box = 1`, `consecutiveCorrect = 0`, `lastAskedIndex = -999` y `dueDistance = 1`.
- **Promoción:** tras 1 acierto consecutivo MUST promoverse a `box = 2` con `dueDistance = 3`; al alcanzar 3 aciertos consecutivos MUST promoverse a `box = 3` con `dueDistance = 8`.
- Los pesos asociados a cada caja MUST ser: **`box 1 → 4.0`, `box 2 → 1.5`, `box 3 → 0.4`**.

#### Scenario: Estado inicial de todas las notas en Caja 1

- **GIVEN** `SpacedRepetitionStrategy`, `activeNotes = [60, 62]` y `history = []`
- **WHEN** se invoca `getNotePerformances`
- **THEN** ambas entradas tienen `weight === 4.0`, `attempts === 0` y `lastResultWasCorrect === null`

#### Scenario: Un acierto promueve a Caja 2

- **GIVEN** `activeNotes = [60, 62]` y un historial con un único acierto en `60`
- **WHEN** se computa el estado Leitner
- **THEN** la nota `60` tiene `box === 2`, `dueDistance === 3` y `weight === 1.5`

#### Scenario: Tres aciertos consecutivos promueven a Caja 3

- **GIVEN** `activeNotes = [60, 62]` y un historial con tres aciertos consecutivos en `60`
- **WHEN** se invoca `getNotePerformances`
- **THEN** `weight(60) === 0.4` (Caja 3 dominada)

### Requirement: Degeneración Inmediata ante el Fallo (SpacedRepetitionStrategy)

Cualquier acierto acumulado MUST (DEBE) colapsar de inmediato ante un único error, sin transiciones intermedias ni conservación de progreso.

- Ante una respuesta incorrecta, la nota afectada MUST pasar instantáneamente a `box = 1`, `dueDistance = 1`, `consecutiveCorrect = 0` y peso `4.0`.
- La degradación MUST aplicarse aunque la nota estuviera en `box = 3` (dominada).
- El estado de una nota MUST NOT verse afectado por respuestas de otra nota.

#### Scenario: Fallo degrada de Caja 3 a Caja 1

- **GIVEN** `activeNotes = [60, 62]` y un historial con tres aciertos en `60` seguidos de un fallo
- **WHEN** se invoca `getNotePerformances`
- **THEN** `weight(60) === 4.0` (de vuelta en Caja 1) y `lastResultWasCorrect(60) === false`

### Requirement: Algoritmo de Prioridad de Selección por Vencimiento (SpacedRepetitionStrategy)

La selección MUST (DEBE) priorizar las notas vencidas de Caja 1 antes de recurrir a la ruleta ponderada.

- El índice de ejercicio actual MUST ser `history.length`.
- MUST considerarse vencida a toda nota candidata en `box === 1` tal que `history.length - lastAskedIndex >= dueDistance`.
- Las notas nunca preguntadas (`lastAskedIndex = -999`) MUST ser siempre vencidas.
- Si existe al menos un vencido, la selección MUST escoger uniformemente entre los vencidos y la `reason` MUST ser `'🔁 Repetición Espaciada (Caja 1: Refuerzo de error vencido)'`.
- Si no hay vencidos, MUST ejecutarse la ruleta ponderada con los pesos 4.0 / 1.5 / 0.4.

#### Scenario: Refuerzo urgente de Caja 1 vencida

- **GIVEN** `activeNotes = [60, 62, 64]` con `62` fallada dos veces (Caja 1 vencida) y `lastPlayedNote = 60`
- **WHEN** se invoca `selectNextNote`
- **THEN** `weightsSnapshot['D4'] === 4.0` y `reason` está definida

#### Scenario: Ruleta cuando no hay Caja 1 vencida

- **GIVEN** `activeNotes = [60, 62, 64]` con tres aciertos recientes y `lastPlayedNote = 60`
- **WHEN** se invoca `selectNextNote`
- **THEN** `selectedNote ∈ [62, 64]` y la `reason` contiene `'Caja'`

#### Scenario: Pesos de la ruleta en el snapshot

- **GIVEN** `activeNotes = [60, 64]` con `60` en Caja 3 y `64` en Caja 1
- **WHEN** se invoca `getNotePerformances`
- **THEN** `weight(60) === 0.4` y `weight(64) === 4.0`

### Requirement: Factory createStrategy y Registro AVAILABLE_STRATEGIES

La capacidad MUST (DEBE) ofrecer un punto único de instanciación y un registro seleccionable por UI.

- `AVAILABLE_STRATEGIES` MUST ser un arreglo con exactamente las tres opciones: `'adaptive_v1'`, `'spaced_repetition'` y `'random'`.
- `createStrategy(id)` MUST instanciar la clase correspondiente: `'random' → RandomSelectionStrategy`, `'adaptive_v1' → AdaptiveV1SelectionStrategy`, `'spaced_repetition' → SpacedRepetitionStrategy`.
- Un identificador desconocido MUST caer por defecto a `AdaptiveV1SelectionStrategy`.
- La fábrica MUST devolver siempre una instancia fresca por invocación.

#### Scenario: Las tres estrategias son instanciables por ID

- **GIVEN** los identificadores `'random'`, `'adaptive_v1'` y `'spaced_repetition'`
- **WHEN** se invoca `createStrategy` con cada uno
- **THEN** se obtienen instancias de `RandomSelectionStrategy`, `AdaptiveV1SelectionStrategy` y `SpacedRepetitionStrategy` respectivamente

#### Scenario: ID desconocido degrada a la estrategia adaptativa

- **GIVEN** un identificador fuera del `StrategyId` canónico
- **WHEN** se invoca `createStrategy`
- **THEN** el resultado es instancia de `AdaptiveV1SelectionStrategy`
