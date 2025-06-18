import typescriptEslint from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"

export default [{
  files: ["**/*.ts"],
}, {
  plugins: {
    "@typescript-eslint": typescriptEslint,
  },

  languageOptions: {
    parser: typescriptParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },

  rules: {
    "@typescript-eslint/naming-convention": ["warn", {
      selector: "import",
      format: ["camelCase", "PascalCase"],
    }],

    curly: "warn",
    eqeqeq: "warn",
    "no-throw-literal": "warn",
    semi: "off",
  },
}]
