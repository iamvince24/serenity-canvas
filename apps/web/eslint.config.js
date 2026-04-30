import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api/_helpers/supabaseAdmin*'],
              message:
                'service-role client 嚴禁在 SPA src/ 中 import；只能在 apps/web/api/ 內使用。',
            },
          ],
          paths: [
            {
              name: '@serenity/shared/supabase/service',
              message:
                'createServiceClient 已從 @serenity/shared 移除；service-role 僅限 apps/web/api/_helpers/supabaseAdmin.ts。',
            },
          ],
        },
      ],
    },
  },
])
