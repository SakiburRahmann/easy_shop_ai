import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'worker-configuration.d.ts'] },
  ...tseslint.configs.recommended,
);
