# Spec Delta

## ADDED Requirements

### Requirement: Validación de esquema del payload de chat-completion
El handler `lm-studio:chat-completion` MUST (DEBE) validar defensivamente el esquema del payload recibido del Renderer antes de cualquier llamada de red: `model` debe ser un string no vacío y `messages` un arreglo no vacío cuyos elementos sean objetos con `role` (string) y `content` (string). Si la validación falla, MUST retornar `{ success: false, error: 'Payload de mensajes inválido' }` sin ejecutar `fetch` y sin lanzar excepciones.

#### Scenario: payload válido fluye sin cambios
- **WHEN** el handler recibe un payload con `model` string no vacío y `messages` arreglo no vacío de objetos con `role` y `content` strings
- **THEN** la validación acepta el payload y el comportamiento es idéntico al actual (llamada al backend con los contratos de retorno existentes)

#### Scenario: payload malformado se rechaza sin red
- **WHEN** el handler recibe un payload con `model` vacío o no string, `messages` vacío o no arreglo, o elementos sin `role`/`content` strings (ej. `messages: [{}]`, `messages: 'hola'`, `model: ''`)
- **THEN** el handler retorna `{ success: false, error: 'Payload de mensajes inválido' }` sin lanzar excepción y sin emitir ninguna petición HTTP

#### Scenario: payload ausente se rechaza sin red
- **WHEN** el handler recibe un payload indefinido o nulo
- **THEN** el handler retorna `{ success: false, error: 'Payload de mensajes inválido' }` sin lanzar excepción y sin emitir ninguna petición HTTP
