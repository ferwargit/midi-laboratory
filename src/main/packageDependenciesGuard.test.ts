import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Guarda de regresión del cambio OpenSpec `reduce-asar-size`
 * (capacidad 10-build-packaging, requisito "Clasificación de dependencias runtime").
 *
 * electron-builder empaqueta en el ASAR únicamente las `dependencies` del
 * manifiesto. Los procesos Main/Preload solo resuelven desde `node_modules`
 * los paquetes listados aquí; todo lo demás (renderer bundleado por Vite,
 * tooling de build) debe permanecer en `devDependencies` para no viajar al
 * instalador como peso muerto.
 */
describe('package.json - Guarda de dependencias runtime (reduce-asar-size)', () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))

  const RUNTIME_DEPENDENCIES = ['@electron-toolkit/preload', '@electron-toolkit/utils']
  const BUILD_TIME_DEPENDENCIES = ['lucide-react', 'zustand', '@tailwindcss/vite', 'tailwindcss']

  it('dependencies contiene única y exclusivamente los módulos runtime de Main/Preload', () => {
    expect(Object.keys(packageJson.dependencies).sort()).toEqual(RUNTIME_DEPENDENCIES.sort())
  })

  it('los paquetes build-time del renderer permanecen en devDependencies', () => {
    for (const dep of BUILD_TIME_DEPENDENCIES) {
      expect(packageJson.devDependencies[dep]).toBeDefined()
      expect(packageJson.dependencies[dep]).toBeUndefined()
    }
  })
})
