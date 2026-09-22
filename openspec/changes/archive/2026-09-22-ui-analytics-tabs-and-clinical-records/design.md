## Context

Las cinco pestañas de analytics comparten Card/Wrappers con `bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80` actual. Los componentes preservan lógica de datos completa (handlers, contratos, memoización). El proyecto usa Tailwind, Lucide icons, y el sistema de diseño Dark Studio DAW definido en AGENTS.md. No hay cambios de dominio; solo modernización visual y tipográfica.

## Goals / Non-Goals

**Goals:**
- Aplicar paleta Dark Studio DAW: fondo rack `bg-slate-900/90 border border-slate-800/80 rounded-xl overflow-hidden`.
- Uniformar métricas numéricas dinámicas a `tabular-nums font-mono text-xs` para evitar jitter.
- Implementar escala semántica de maestría canónica: esmeralda >=85%, ámbar 60-84%, carmesí <60%.
- Alinear acciones con iconos Lucide y mantener comportamiento del modal SessionDetailModal vía portal.
- Mejorar barra flotante de acciones múltiples con estilo panel rack oscuro.
- Mantener 100% de lógica de datos, handlers y contratos existentes.

**Non-Goals:**
- No modificar especificaciones de dominio, modelos de datos ni flujos de IA.
- No agregar selectores duplicados ni nuevas funcionalidades.
- No cambiar API pública de componentes.

## Decisions

- **Tailwind solo**: Cambios de clase solo, sin nuevos componentes. Razonable: velocidad y consistencia con codebase.
- **Mantener memoización**: `ConsultationHistoryItem` y otros memoizados se conservan tal cual para hot-path de MIDI.
- **Badges semánticos**: Usar clases condicionales existentes para colores; no introducir nueva librería de UI.
- **Prettier obligatorio**: Ejecutar `npx prettier --write` después de edits para cumplir `.prettierrc.yaml`.

Alternativas descartadas: migrar a design system nuevo o reescribir tablas con librería externa. Riesgo de regresión innecesario.

## Risks / Trade-offs

- [Regresión visual] Cambios de color/typography pueden afectar contraste. → Mitigación: revisar contra guía Dark Studio DAW y tests visuales manuales.
- [CLS por cambio de tamaño] Aumento de `tabular-nums` puede cambiar ancho. → Mitigación: reservar dimensiones fijas en tarjetas.
- [Falsos positivos en tests] Cambios de clase no afectan tests unitarios pero validar con `npm run typecheck` y `npm run test`.

## Migration Plan

- Editar archivos objetivo, aplicar clases Tailwind según especificaciones de diseño.
- Formatear con Prettier.
- Ejecutar `npm run typecheck` y `npm run test` para validar sin regresiones.
- Rollback sencillo: revert commit con 5 archivos modificados.
