/**
 * ESLint flat config: typescript-eslint strict + Next.js rules.
 */
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.strict,
  {
    rules: {
      'no-console': 'error'
    }
  },
  {
    /**
     * The production entry point is CommonJS by necessity: a hosting panel
     * that requires the startup file in-process cannot load an ES module.
     */
    files: ['server.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts']
  }
);
