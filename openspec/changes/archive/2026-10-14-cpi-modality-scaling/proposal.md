# Proposal

## Why

`calculateSessionCPI` compara la velocidad de respuesta rígidamente contra la línea base de **Nota Individual** (`15.0 RPM` y `1.5s` de latencia objetivo), independientemente de la modalidad de la práctica. Esto genera una penalización matemática severa en modalidades complejas: una sesión de **Intervalos** con 2100ms y 15.3 RPM —que representa el 100% de velocidad refleja para esa modalidad— recibe un speedFactor de 0.72 y un Score CPI de **356 pts**, frente a los **1317 pts** de una Nota Individual con idéntica precisión y esfuerzo reflejo. El problema fue confirmado como hallazgo **Incoherencia 1** en la auditoría de psicometría.

## What Changes

- **Nuevo SSOT de configuración CPI por modalidad** (`CPI_CONFIG_BY_MODE`) en `thresholds.ts` con líneas base distintas para cada modo: `single_note`, `intervals`, `sequences`, `repertoire` y `global`.
- **Modificación de `calculateSessionCPI`** para aceptar un parámetro opcional `mode?: string` (default `'single_note'`), usando `CPI_CONFIG_BY_MODE` en lugar de los literales `15.0` / `1.5` en el cálculo de `speedFactor`.
- **Propagación del `sessionMode`** en `historyAnalytics.ts` y `SessionDetailModal.tsx` al invocar `calculateSessionCPI`, resolviendo el modo desde `session.targetMode` con fallback a los clasificadores existentes.
- **Pruebas unitarias TDD** en `historyAnalytics.test.ts` verificando retrocompatibilidad exacta y la corrección de la penalización en Intervalos.

## Capabilities

### New Capabilities

- `cpi-modality-scaling`: Configuración canónica de normalización matemática del Score CPI por modalidad de práctica. Define los valores objetivo de latencia y cadencia que representan el 100% de velocidad refleja para cada modo, eliminando la penalización artificial debida a la comparación contra una sola línea base.

### Modified Capabilities

- `05-analytics-psychometrics`: El requisito de speedFactor se modifica para usar umbrales por modalidad en lugar de líneas base fijas. El comportamiento de `single_note` (sin argumento) se conserva exactamente idéntico para retrocompatibilidad total.

## Impact

- **Archivos afectados**:
  - `src/renderer/src/domain/analytics/thresholds.ts` — nueva constante `CPI_CONFIG_BY_MODE`.
  - `src/renderer/src/domain/analytics/psychometrics.ts` — modificación de `calculateSessionCPI` ( Breaking change menor: nuevo parámetro opcional).
  - `src/renderer/src/domain/analytics/historyAnalytics.ts` — pasar `sessionMode` en la invocación.
  - `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` — pasar `sessionMode` en la invocación.
  - `src/renderer/src/domain/analytics/historyAnalytics.test.ts` — nuevos tests TDD.
- **Retrocompatibilidad**: el nuevo parámetro `mode?` es opcional y defaultea a `'single_note'`, por lo que todas las firmas previas siguen funcionando sin modificación.
- **Dependencias**: ninguna. Es un cambio autocontenida en la capa de dominio de analítica.