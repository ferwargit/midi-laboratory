import { describe, it, expect } from 'vitest'
import { resolveLmStudioHost, LM_STUDIO_DEFAULT_HOST } from './lmStudioHostValidator'

describe('lmStudioHostValidator - Allowlist de host local para baseUrl (hallazgo F5)', () => {
  describe('resolución del host canónico', () => {
    it('resuelve baseUrl ausente al host canónico', () => {
      const result = resolveLmStudioHost(undefined)
      expect(result).toEqual({ ok: true, host: LM_STUDIO_DEFAULT_HOST })
      if (result.ok) expect(result.host).toBe('http://127.0.0.1:1234')
    })

    it('resuelve baseUrl vacía al host canónico', () => {
      expect(resolveLmStudioHost('')).toEqual({ ok: true, host: 'http://127.0.0.1:1234' })
    })

    it('resuelve baseUrl solo con espacios al host canónico', () => {
      expect(resolveLmStudioHost('   ')).toEqual({ ok: true, host: 'http://127.0.0.1:1234' })
    })
  })

  describe('hosts locales válidos', () => {
    it('acepta el host canónico con puerto 1234', () => {
      expect(resolveLmStudioHost('http://127.0.0.1:1234')).toEqual({
        ok: true,
        host: 'http://127.0.0.1:1234'
      })
    })

    it('acepta localhost en otro puerto', () => {
      expect(resolveLmStudioHost('http://localhost:8080')).toEqual({
        ok: true,
        host: 'http://localhost:8080'
      })
    })

    it('acepta https sobre localhost', () => {
      expect(resolveLmStudioHost('https://localhost:1234')).toEqual({
        ok: true,
        host: 'https://localhost:1234'
      })
    })

    it('acepta puertos en los límites válidos (1 y 65535)', () => {
      expect(resolveLmStudioHost('http://127.0.0.1:1')).toEqual({
        ok: true,
        host: 'http://127.0.0.1:1'
      })
      expect(resolveLmStudioHost('http://127.0.0.1:65535')).toEqual({
        ok: true,
        host: 'http://127.0.0.1:65535'
      })
    })

    it('acepta host local sin puerto explícito', () => {
      expect(resolveLmStudioHost('http://127.0.0.1')).toEqual({
        ok: true,
        host: 'http://127.0.0.1'
      })
    })

    it('normaliza mayúsculas del host (URL parser)', () => {
      expect(resolveLmStudioHost('http://LOCALHOST:1234')).toEqual({
        ok: true,
        host: 'http://localhost:1234'
      })
    })
  })

  describe('rechazo de destinos no locales (SSRF)', () => {
    it('rechaza IPs privadas de red local', () => {
      for (const url of [
        'http://192.168.1.10:1234',
        'http://10.0.0.5:1234',
        'http://172.16.0.1:1234'
      ]) {
        const result = resolveLmStudioHost(url)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason.length).toBeGreaterThan(0)
      }
    })

    it('rechaza IPs públicas', () => {
      const result = resolveLmStudioHost('http://8.8.8.8:1234')
      expect(result.ok).toBe(false)
    })

    it('rechaza dominios remotos', () => {
      expect(resolveLmStudioHost('http://evil.example.com').ok).toBe(false)
      expect(resolveLmStudioHost('https://internal.corp.local').ok).toBe(false)
    })

    it('rechaza variantes de localhost fuera del allowlist (fail-closed)', () => {
      expect(resolveLmStudioHost('http://[::1]:1234').ok).toBe(false)
      expect(resolveLmStudioHost('http://0.0.0.0:1234').ok).toBe(false)
      expect(resolveLmStudioHost('http://127.0.0.2:1234').ok).toBe(false)
    })
  })

  describe('rechazo de protocolos no HTTP y URLs malformadas', () => {
    it('rechaza protocolos distintos de http/https', () => {
      expect(resolveLmStudioHost('file:///etc/passwd').ok).toBe(false)
      expect(resolveLmStudioHost('ftp://127.0.0.1').ok).toBe(false)
    })

    it('rechaza cadenas que no parsean como URL', () => {
      expect(resolveLmStudioHost('not-a-url').ok).toBe(false)
      expect(resolveLmStudioHost('127.0.0.1:1234').ok).toBe(false)
    })

    it('rechaza puertos fuera del rango válido (1-65535)', () => {
      expect(resolveLmStudioHost('http://127.0.0.1:0').ok).toBe(false)
      expect(resolveLmStudioHost('http://127.0.0.1:99999').ok).toBe(false)
    })
  })
})
