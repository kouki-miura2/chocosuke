import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    // Claude Design export kept as a reference until implementation (see docs/spec.md)
    ignorePatterns: ['docs/design/**'],
    semi: false,
    singleQuote: true,
    sortImports: true,
  },
  lint: {
    ignorePatterns: ['docs/design/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
})
