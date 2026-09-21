## 1. Preparación y configuración

- [x] 1.1 Verificar que lucide-react@^1.47.0 está en package.json y ejecutar npm install si es necesario
- [x] 1.2 Confirmar que los tipos de React están actualizados (ya incluidos en devDependencies)
- [x] 1.3 Ejecutar npm run typecheck para establecer línea base de tipos (0 errores esperado)
- [x] 1.4 Ejecutar npm run test para establecer línea base de tests (533 tests pasando esperado)

## 2. Actualización de StudioTopBar.tsx

- [x] 2.1 Importar iconos necesarios de lucide-react: Music, ArrowLeftRight, AudioLines, BookOpen, Activity, Ear, Eye, SlidersHorizontal, Cable
- [x] 2.2 Reemplazar emoji 🎹 en branding (línea 47) por <Music className="w-4 h-4" />
- [x] 2.3 Reemplazar botones de modo (líneas 100-101) por iconos semánticos:
  - single_note: <Music className="w-4 h-4 mr-1.5" />
  - intervals: <ArrowLeftRight className="w-4 h-4 mr-1.5" />
  - sequences: <AudioLines className="w-4 h-4 mr-1.5" />
  - repertoire: <BookOpen className="w-4 h-4 mr-1.5" />
  - analytics: <Activity className="w-4 h-4 mr-1.5" />
- [x] 2.4 Reemplazar toggle audiovisual (líneas 120 y 132):
  - Blind (Oído Puro): <Ear className="w-4 h-4 mr-1.5 text-cyan-400" />
  - Assisted (Asistido): <Eye className="w-4 h-4 mr-1.5 text-amber-400" />
- [x] 2.5 Reemplazar indicadores de Popover de Puertos MIDI (líneas 144 y 148):
  - DIN-5: <SlidersHorizontal className="w-4 h-4 mr-1.5" />
  - ⚙️ (config): <Cable className="w-4 h-4 mr-1.5" />
- [x] 2.6 Verificar que todos los iconos usan clases Tailwind apropiadas (w-4 h-4 mr-1.5, text-* cuando aplique)
- [x] 2.7 Ejecutar npm run typecheck y confirmar 0 errores en este archivo
- [x] 2.8 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 3. Actualización de StudioBottomDock.tsx

- [x] 3.1 Importar iconos necesarios: Download, Upload, Terminal, RotateCcw
- [x] 3.2 Reemplazar emoji 📥 en botón Exportar Backup (línea 118) por <Download className="w-3.5 h-3.5 mr-1" />
- [x] 3.3 Reemplazar emoji 📤 en botón Importar Backup (línea 129) por <Upload className="w-3.5 h-3.5 mr-1" />
- [x] 3.4 Reemplazar texto "Reset DB" (línea 146) por <RotateCcw className="w-3.5 h-3.5 mr-1" /> + texto
- [x] 3.5 Reemplazar emoji 📡 en botón Telemetría (línea 154) por <Terminal className="w-3.5 h-3.5 mr-1" />
- [x] 3.6 Verificar tamaños w-3.5 h-3.5 mr-1 consistentes con Diseño
- [x] 3.7 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 3.8 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 4. Actualización de DatabaseCard.tsx

- [x] 4.1 Importar iconos necesarios: Download, Upload, RotateCcw, Database, CheckCircle2, AlertCircle
- [x] 4.2 Reemplazar emoji 📥 en botón Exportar Backup (línea 79) por <Download className="w-3.5 h-3.5 mr-1" />
- [x] 4.3 Reemplazar emoji 📤 en botón Importar Backup (línea 89) por <Upload className="w-3.5 h-3.5 mr-1" />
- [x] 4.4 Reemplazar emoji 🗑️ en botón Resetear DB (línea 105) por <RotateCcw className="w-3.5 h-3.5 mr-1" />
- [x] 4.5 Reemplazar emoji 💾 en cabecera por <Database className="w-4 h-4 mr-1.5 text-cyan-400" />
- [x] 4.6 Reemplazar emojis ✅/❌ en mensajes de estado por <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> / <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-400" />
- [x] 4.7 Verificar tamaños w-3.5 h-3.5 mr-1 consistentes con Diseño
- [x] 4.8 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 4.9 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 5. Actualización de FeedbackPanel.tsx

- [x] 5.1 Importar iconos necesarios: Play, SkipForward
- [x] 5.2 Reemplazar botón de avance manual (líneas 95-102) por:
  - Botón Play (▶): <Play className="w-4 h-4 mr-1.5 fill-current" />
  - Mantener texto "Siguiente Pregunta ➔" y accesibilidad
- [x] 5.3 Reemplazar indicador de avance automático (líneas 111-113) por:
  - <SkipForward className="w-4 h-4 mr-1.5" />
  - Texto "Avanzando automáticamente..."
- [x] 5.4 Verificar clases: w-4 h-4 mr-1.5 fill-current para Play, w-4 h-4 mr-1.5 para SkipForward
- [x] 5.5 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 5.6 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 6. Actualización de IntervalFeedbackPanel.tsx

- [x] 6.1 Importar iconos necesarios: Play, SkipForward
- [x] 6.2 Reemplazar indicadores de estado (líneas 35, 39, 45, 50) por iconos semánticos:
  - Escuchando (línea 35): mantener animate-ping pero considerar alternativa
  - Primera nota (línea 39): <Play className="w-4 h-4 mr-1.5 fill-current" /> (concepto de inicio)
  - Segunda nota (línea 40): <Play className="w-4 h-4 mr-1.5 fill-current" />
  - Dirección (líneas 45-48): mantener flechas ⬆️⬇️ como son puramente informativas
- [x] 6.3 Reemplazar botón de avance manual (líneas 99-106) por:
  - <Play className="w-4 h-4 mr-1.5 fill-current" /> + texto "Siguiente Intervalo ➔"
- [x] 6.4 Reemplazar indicador de avance automático (líneas 111-113) por:
  - <SkipForward className="w-4 h-4 mr-1.5" />
- [x] 6.5 Verificar que mantemos la semántica visual correcta (Play para inicio de acción, SkipForward para avance)
- [x] 6.6 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 6.7 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 7. Actualización de SequenceFeedbackPanel.tsx

- [x] 7.1 Importar iconos necesarios: Play, SkipForward
- [x] 7.2 Reemplazar indicador de espera (líneas 29-31) por:
  - <Play className="w-4 h-4 mr-1.5" /> (animado) + texto instructivo
- [x] 7.3 Reemplazar botón de avance manual (líneas 86-93) por:
  - <Play className="w-4 h-4 mr-1.5 fill-current" /> + texto "Siguiente ➔ (Espacio)"
- [x] 7.4 Verificar tamaños y clases apropiadas
- [x] 7.5 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 7.6 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 8. Actualización de RepertoireFeedbackPanel.tsx

- [x] 8.1 Importar iconos necesarios: Play, SkipForward, RotateCcw, Ghost, Sparkles, Palette
- [x] 8.2 Reemplazar indicador de espera (líneas 39-41) por:
  - <Play className="w-3.5 h-3.5 mr-1.5" /> (animado) + texto instructivo
- [x] 8.3 Reemplazar botón de repetir slice (líneas 65-72) por:
  - <RotateCcw className="w-3.5 h-3.5 mr-1" /> + texto "Escuchar (R)"
- [x] 8.4 Reemplazar botón de avance manual (líneas 128-135) por:
  - <Play className="w-4 h-4 mr-1.5 fill-current" /> + texto "Siguiente Paso ➔ (Espacio)"
- [x] 8.5 Reemplazar emojis 👻, ✨, 🎨 en selector de tema por <Ghost className="w-3.5 h-3.5 mr-1" />, <Sparkles className="w-3.5 h-3.5 mr-1" />, <Palette className="w-3.5 h-3.5 mr-1" />
- [x] 8.6 Verificar tamaños: w-3.5 h-3.5 para iconos secundarios, w-4 h-4 para botones primarios
- [x] 8.7 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 8.8 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 9. Actualización de SingleNoteView.tsx

- [x] 9.1 Importar iconos necesarios: Play, Square, RotateCcw, Clock, Ghost, Sparkles, Palette
- [x] 9.2 Reemplazar botón de repetir estímulo (líneas 159-161) por:
  - <RotateCcw className="w-4 h-4 mr-1.5" /> + texto "Repetir (R)"
- [x] 9.3 Reemplazar botón de detener sesión (líneas 162-164) por:
  - <Square className="w-4 h-4 mr-1.5" /> + texto "Detener y Guardar"
- [x] 9.4 Reemplazar emoji ⏳ en progreso de sesión por <Clock className="w-3.5 h-3.5 mr-1" />
- [x] 9.5 Reemplazar emojis 👻, ✨, 🎨 en selector de tema por <Ghost className="w-3.5 h-3.5 mr-1" />, <Sparkles className="w-3.5 h-3.5 mr-1" />, <Palette className="w-3.5 h-3.5 mr-1" />
- [x] 9.6 Verificar clases: w-4 h-4 mr-1.5 fill-current para RotateCcw y Square
- [x] 9.7 Ejecutar npm run typecheck y confirmar 0 errores
- [x] 9.8 Ejecutar npm run test y confirmar que todos los tests siguen pasando

## 10. Validación final y barrido total de emojis residuales

- [x] 10.1 Ejecutar npm run typecheck y confirmar 0 errores totales
- [x] 10.2 Ejecutar npm run test y confirmar 533 tests pasan sin regresión
- [x] 10.3 Verificar que no hay emojis restantes en los archivos modificados (barrido completo)
- [x] 10.4 Confirmar que todos los iconos lucide-react se importan correctamente y no hay imports no usados
- [x] 10.5 Validar que los tamaños y márgenes son consistentes (w-4 h-4 mr-1.5 o w-3.5 h-3.5 mr-1)
- [x] 10.6 Reemplazar '✕' en StudioTopBar por <X className="w-4 h-4" />
- [x] 10.7 Reemplazar '▼'/'▲' en StudioBottomDock por <ChevronDown className="w-3.5 h-3.5" /> / <ChevronUp className="w-3.5 h-3.5" />
- [x] 10.8 Solicitar revisión visual de pares para confirmar coherencia con estética Pro Audio
