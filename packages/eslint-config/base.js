/** @type {import("eslint").Linter.Config} */
// O eslint-config-turbo exporta o objeto de config direto, sem `.default`. Lendo
// `.default` o require devolvia undefined e o `...turboConfig.extends` abaixo
// derrubava o carregamento — nenhum pacote do monorepo conseguia rodar o lint.
const turboConfig = require("eslint-config-turbo");

module.exports = {
  root: true,
  ...turboConfig,
  extends: [
    ...turboConfig.extends,
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "prettier",
  ],
  plugins: [...(turboConfig.plugins || []), "@typescript-eslint/eslint-plugin"],
  parser: "@typescript-eslint/parser",
  ignorePatterns: [
    ".*.js",
    "*.setup.js",
    "*.config.js",
    ".turbo/",
    "dist/",
    "coverage/",
    "node_modules/",
    ".husky/",
  ],
};
