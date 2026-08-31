# Análisis de la Estructura y Tecnologías del Proyecto

## 🎯 Resumen Ejecutivo

**MIDI Ear Trainer** es una aplicación de escritorio para entrenamiento auditivo musical que combina hardware MIDI físico con inteligencia artificial local. Es una aplicación Electron moderna con React 19 y TypeScript 5.9.

---

## 🛠️ Stack Tecnológico Principal

### Marco de Trabajo y Entorno de Ejecución

- **Electron 43.4.0** — Entorno de ejecución para aplicaciones de escritorio (Chromium + Node.js)
- **React 19.2.1** — Biblioteca de interfaz de usuario con nuevas capacidades de React 19
- **TypeScript 5.9.3** — Lenguaje tipado estricto
- **Vite 7.2.6** — Herramienta de construcción y servidor de desarrollo ultrarrápido
- **Electron-Vite 5.0.0** — Integración Electron + Vite con HMR (recarga en caliente)

### Estado y Interfaz de Usuario

- **Zustand 5.0.15** — Gestión de estado ligera (alternativa a Redux)
- **Tailwind CSS 4.3.3** — Marco de trabajo CSS basado en utilidades (versión más reciente)
- **@tailwindcss/vite 4.3.3** — Complemento Vite para Tailwind v4

### Calidad de Código

- **ESLint 9.39.1** — Linter con flat config (nueva API)
- **Prettier 3.7.4** — Formateador de código
- **TypeScript strict mode** — Configuración de tipos estricta

### Pruebas

- **Vitest 4.1.10** — Marco de trabajo de pruebas moderno (compatible con Vite)
- **@testing-library/react 16.3.2** — Pruebas de componentes React
- **@vitest/coverage-v8 4.1.11** — Cobertura de código con V8
- **jsdom 29.1.1** — Entorno DOM simulado para pruebas
- **fake-indexeddb 6.2.5** — Simulación de IndexedDB para pruebas

### Construcción y Distribución

- **electron-builder 26.0.12** — Empaquetado de aplicación para Windows/Mac/Linux
- **app-builder-lib** — Librería interna de electron-builder

---

## 🏗️ Arquitectura del Proyecto

### Estructura de Procesos Electron

```
┌─────────────────────────────────────────┐
│  PROCESO PRINCIPAL (Node.js)            │
│  - src/main/index.ts                    │
│  - Gestión de ventanas                  │
│  - Manejadores IPC                      │
│  - Acceso al sistema de archivos        │
└─────────────────┬───────────────────────┘
                  │ Puente IPC
┌─────────────────┴───────────────────────┐
│  SCRIPT DE PRECARGA                     │
│  - src/preload/index.ts                 │
│  - Expone APIs seguras al renderizador  │
│  - Aislamiento de contexto: activado    │
│  - Sandbox: desactivado (intencional)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│  PROCESO RENDERIZADOR (React + Web APIs)│
│  - src/renderer/src/                    │
│  - Interfaz de usuario                  │
│  - API Web MIDI                         │
│  - API Web Audio                        │
│  - IndexedDB                            │
└─────────────────────────────────────────┘
```

### Organización del Código del Renderizador

```
src/renderer/src/
├── components/          # Componentes React
│   ├── trainer/        # Componentes específicos del entrenador
│   └── ui/             # Componentes reutilizables
├── domain/             # Lógica de negocio pura (sin React)
├── hooks/              # Hooks personalizados de React
├── services/           # Servicios (IA, analizadores)
├── stores/             # Almacenes Zustand
└── App.tsx            # Componente raíz
```

---

## 🎹 APIs Nativas Web

### Web MIDI API

- Comunicación de baja latencia con hardware MIDI
- Hardware soportado: Roland FP-8, Roland UM-ONE mk2, Korg NS5R
- Sin dependencias externas, API nativa del navegador

### API Web Audio

- Síntesis de estímulos auditivos precisos
- Generación de tonos y señales sincronizadas
- Control de temporización preciso

### IndexedDB

- Persistencia local de sesiones, respuestas e informes
- Envoltorio personalizado `DatabaseEngine`
- Respaldo/restauración en formato JSON portable

---

## 🤖 Integración con IA Local

- **LM Studio** en localhost (puerto 1234)
- Modelo: Qwen 3.5 ejecutándose en GPU NVIDIA
- Comunicación via IPC seguro (main process) o fetch directo (renderer)
- **Sin claves API** — Todo local, datos no salen de la máquina
- CSP configurado: `connect-src 'self' http://127.0.0.1:1234`

---

## 📦 Configuraciones Clave

### TypeScript

- **Configuración modular**: `tsconfig.json` como proyecto de referencias
- `tsconfig.node.json` — Para proceso principal/precarga (Node.js)
- `tsconfig.web.json` — Para renderizador (DOM)
- Alias: `@renderer` → `src/renderer/src`

### Vite/Electron-Vite

- Complemento React con HMR
- Complemento Tailwind CSS v4
- Alias configurado para importaciones limpias
- Construcción optimizada para producción

### Vitest

- Entorno: jsdom
- Ejecución: bifurcaciones con 1 trabajador (serializado para IndexedDB)
- Cobertura: proveedor V8 nativo
- Incluye: `src/**/*.{test,spec}.{ts,tsx}`
- Cobertura focalizada en `domain/`, `stores/`, `hooks/`, `services/`

### ESLint

- Configuración plana (nueva API de ESLint 9)
- Configuraciones del Kit de herramientas Electron
- Complementos: React, React Hooks, React Refresh
- Corrección automática habilitada

### Prettier

- Comillas simples
- Sin punto y coma
- Ancho de impresión: 100
- Sin comas finales

### Electron Builder

- AppId: `com.electron.app`
- Producto: `midi-laboratory`
- Soporta: Windows (NSIS), macOS (DMG), Linux (AppImage/snap/deb)
- Desempaquetado ASAR para recursos
- Excluye archivos de desarrollo de la construcción

---

## 🔐 Modelo de Seguridad

| Configuración | Valor | Razón |
|---------------|-------|-------|
| **contextIsolation** | `true` | Aísla el renderizador de Node.js |
| **sandbox** | `false` | Intencional para `window.customAPI` |
| **nodeIntegration** | `false` | Renderizador sin acceso directo a Node |
| **IPC** | Con tiempos de espera y AbortController | Previene bloqueos |
| **CSP** | Permite localhost:1234 | Para LM Studio local |

---

## 📊 Scripts NPM Disponibles

| Script | Propósito |
|--------|-----------|
| `npm run dev` | Desarrollo con HMR (recarga en caliente) |
| `npm start` | Vista previa de la construcción |
| `npm run build` | Construcción completa (verificación de tipos + vite) |
| `npm run build:win` | Instalador Windows |
| `npm run test` | Pruebas unitarias |
| `npm run test:coverage` | Pruebas + cobertura |
| `npm run test:watch` | Modo observación |
| `npm run lint` | ESLint con corrección automática |
| `npm run format` | Prettier |
| `npm run typecheck` | Verificación TypeScript completa |

---

## 🎯 Características Técnicas Distintivas

1. **Diseño Orientado al Dominio** — Lógica pura separada de React
2. **Nativo Primero** — APIs web nativas sin envoltorios pesados
3. **IA Local Primero** — IA ejecutándose localmente sin dependencias en la nube
4. **Pruebas robustas** — >86% cobertura, 138+ pruebas
5. **TypeScript estricto** — Seguridad de tipos completa
6. **Experiencia de Desarrollo moderna** — Vite 7, ESLint 9 configuración plana, Vitest 4, React 19
7. **Adaptación inteligente** — Algoritmos de repetición espaciada (SM-2, Leitner)
8. **Persistencia portable** — Respaldo/restauración JSON

---

## 📚 Documentación Adicional

El proyecto incluye documentación exhaustiva:

- `ARCHITECTURE.md` — Decisiones arquitectónicas (ADR-style)
- `README.md` — Documentación completa (17,874 caracteres)
- `PROJECT_EXPLANATION_V1.md` — Análisis técnico detallado
- `REPERTOIRE_LEARNING_V1/V2_SPEC.md` — Especificaciones de modos
- `AUDIT_REPORT_V*_ARCHIVE.md` — Auditorías históricas

---

## 🎼 Modalidades de Entrenamiento

1. **Nota Individual** — Reconocimiento de altura absoluta
2. **Intervalos** — 13 clases de intervalos con evaluación separada auditiva/motora
3. **Secuencias** — Memoria melódica 3-6 notas con evaluación por capas
4. **Repertorio** — Práctica con partituras MusicXML 4.0
5. **Analytics + IA** — Dashboard científico con consultas a LLM local

---

## 💡 Conclusión

Este es un proyecto técnicamente sofisticado que combina tecnologías web modernas, procesamiento de audio/MIDI en tiempo real, inteligencia artificial local y algoritmos adaptativos para crear una herramienta profesional de entrenamiento auditivo musical.

### Puntos Clave

- **Stack moderno y actualizado**: Todas las dependencias principales están en sus últimas versiones (React 19, Vite 7, TypeScript 5.9)
- **Arquitectura robusta**: Separación clara entre procesos Electron, lógica de dominio y presentación
- **Seguridad considerada**: Context isolation, IPC seguro, CSP configurado
- **Developer Experience**: Tooling completo con testing, linting, formatting y type checking
- **Local-first**: Sin dependencias cloud, toda la funcionalidad ejecuta localmente

---

*Documento generado: 29 de agosto de 2026*

