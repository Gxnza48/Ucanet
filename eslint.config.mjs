import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'

// PART 27 §27.4 — import boundaries as configuration, not convention.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // Los patrones son de CARPETA (`'app'`, `'features/*'`), no de archivo
        // (`'app/**/*'`): con patrones de archivo, eslint-plugin-boundaries v7 no
        // clasifica nada y la regla pasa en verde sin haber revisado un solo import.
        // Un lint que no corre es peor que no tenerlo. Verificado con
        // `boundaries/no-unknown-files` y con violaciones deliberadas en ambas
        // direcciones; ver docs/decisions.md.
        { type: 'app', pattern: 'app' },
        { type: 'features', pattern: 'features/*', capture: ['feature'] },
        { type: 'ui', pattern: 'components/ui' },
        { type: 'lib', pattern: 'lib' },
      ],
    },
    rules: {
      // PART 27 §27.4 — las dos prohibiciones que sostienen la arquitectura:
      // una feature NUNCA importa otra feature (lo compartido se promueve a lib/ o
      // components/ui), y lib/ no sabe qué app sirve (es lo que la hace extraíble).
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { types: { anyOf: ['app', 'features', 'ui', 'lib'] } } } },
            },
            {
              from: { element: { type: 'features' } },
              allow: {
                to: {
                  element: {
                    // Solo la MISMA feature: el capture `feature` tiene que coincidir.
                    type: 'features',
                    captured: { feature: '{{from.captured.feature}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'features' } },
              allow: { to: { element: { types: { anyOf: ['ui', 'lib'] } } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: { anyOf: ['ui', 'lib'] } } } },
            },
            {
              from: { element: { type: 'lib' } },
              allow: { to: { element: { type: 'lib' } } },
            },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'lib/types.gen.ts',
    'playwright-report/**',
    'test-results/**',
    'supabase/.temp/**',
  ]),
])

export default eslintConfig
