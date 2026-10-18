import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { isOpenExternalUrlAllowed, isAllowedNavigation } from './windowNavigationGuard'

describe('windowNavigationGuard - Validación estricta de esquema en apertura externa (F7)', () => {
  it('acepta URLs https y http legítimas', () => {
    expect(isOpenExternalUrlAllowed('https://github.com/ferwargit/midi-laboratory')).toBe(true)
    expect(isOpenExternalUrlAllowed('http://example.com/page')).toBe(true)
  })

  it('normaliza mayúsculas del esquema (URL parser)', () => {
    expect(isOpenExternalUrlAllowed('HTTPS://example.com')).toBe(true)
  })

  it('rechaza esquemas peligrosos sin abrir', () => {
    expect(isOpenExternalUrlAllowed('file:///C:/secrets.txt')).toBe(false)
    expect(isOpenExternalUrlAllowed('javascript:alert(1)')).toBe(false)
    expect(isOpenExternalUrlAllowed('data:text/html,<h1>x</h1>')).toBe(false)
    expect(isOpenExternalUrlAllowed('ftp://127.0.0.1')).toBe(false)
  })

  it('rechaza URLs malformadas sin abrir', () => {
    expect(isOpenExternalUrlAllowed('not-a-url')).toBe(false)
    expect(isOpenExternalUrlAllowed('https:')).toBe(false)
    expect(isOpenExternalUrlAllowed('')).toBe(false)
  })
})

describe('windowNavigationGuard - Prevención de navegaciones in-frame (F8)', () => {
  const DEV_ORIGIN = 'http://localhost:5173'
  const PROD_ORIGIN = 'file://'

  it('permite la navegación al origen propio en desarrollo', () => {
    expect(isAllowedNavigation('http://localhost:5173/src/main.tsx', DEV_ORIGIN)).toBe(true)
    expect(isAllowedNavigation('http://localhost:5173/', DEV_ORIGIN)).toBe(true)
  })

  it('permite la navegación al origen propio en producción (file://)', () => {
    expect(isAllowedNavigation('file:///C:/app/out/renderer/index.html', PROD_ORIGIN)).toBe(true)
  })

  it('cancela la navegación a orígenes ajenos', () => {
    expect(isAllowedNavigation('https://evil.example.com', DEV_ORIGIN)).toBe(false)
    expect(isAllowedNavigation('http://192.168.1.10/', DEV_ORIGIN)).toBe(false)
    expect(isAllowedNavigation('https://evil.example.com', PROD_ORIGIN)).toBe(false)
  })

  it('cancela la navegación con sufijos de suplantación del origen propio', () => {
    expect(isAllowedNavigation('https://localhost:5173.evil.com', DEV_ORIGIN)).toBe(false)
  })

  it('cancela la navegación con URLs malformadas', () => {
    expect(isAllowedNavigation('not-a-url', DEV_ORIGIN)).toBe(false)
    expect(isAllowedNavigation('', DEV_ORIGIN)).toBe(false)
  })
})

describe('windowNavigationGuard - Cableado del Main (F7/F8/F9)', () => {
  const mainSource = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8')

  it('registra el listener will-navigate con cancelación auditable', () => {
    expect(mainSource).toContain("on('will-navigate'")
    expect(mainSource).toContain('event.preventDefault()')
    expect(mainSource).toContain('[Navegación] Cancelada')
  })

  it('configura devTools explicitamente segun el entorno', () => {
    expect(mainSource).toContain('devTools: is.dev')
  })

  it('delega a shell.openExternal solo tras la guarda de esquema', () => {
    expect(mainSource).toContain('isOpenExternalUrlAllowed(details.url)')
    expect(mainSource).not.toContain("startsWith('https:')")
    expect(mainSource).not.toContain("startsWith('http:')")
  })
})
