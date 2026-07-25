const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat.js");
const reactPlugin = require("eslint-plugin-react");

const disabledReactRules = Object.fromEntries(
  Object.keys(reactPlugin.rules).map((ruleName) => [
    `react/${ruleName}`,
    "off",
  ]),
);

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/**", ".expo/**"],
    rules: {
      ...disabledReactRules,
    },
  },
]);
