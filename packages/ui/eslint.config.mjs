import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.config({
    extends: ['@hed-hog/eslint-config/react-internal.js'],
    parserOptions: {
      project: './tsconfig.lint.json',
      tsconfigRootDir: __dirname,
    },
  }),
];
