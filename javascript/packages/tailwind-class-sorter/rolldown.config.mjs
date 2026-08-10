export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: [
      "tailwindcss",
      "tailwindcss/loadConfig.js",
      "tailwindcss/resolveConfig.js",
      "tailwindcss/lib/lib/generateRules.js",
      "tailwindcss/lib/lib/setupContextUtils.js",
      "fs/promises",
      "path",
      "url"
    ],
    platform: "node",
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: [
      "tailwindcss",
      "tailwindcss/loadConfig.js",
      "tailwindcss/resolveConfig.js",
      "tailwindcss/lib/lib/generateRules.js",
      "tailwindcss/lib/lib/setupContextUtils.js",
      "fs/promises",
      "path",
      "url"
    ],
    platform: "node",
  },
]
