/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@hedhog/eslint-config/nest.js'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
};
