const RENAMED = "__herbNodeRequire"

// Emscripten emits `var require = createRequire(import.meta.url)` inside the
// generated module. When a bundler rewrites that module to CommonJS it turns
// `import.meta.url` into a `require("url")` call, which then resolves to this
// hoisted local binding instead of the real CommonJS require, and the module
// throws `require is not a function` at load time. Renaming the binding keeps
// the two apart. Applied here so every downstream bundle inherits the fix.
//
// Workaround for https://github.com/rolldown/rolldown/pull/10655. Once a
// rolldown release carries that fix, drop this plugin and its use in
// `rolldown.config.mjs`, then rebuild and check that
// `dist/herb-node-wasm.cjs` still loads.
const PROBE = `export async function init() {
  const { createRequire } = await import("node:module")
  var require = createRequire(import.meta.url)

  const path = require("node:path")
  const os = require("node:os")

  return path.sep + os.EOL
}`

const SHADOWED_REQUIRE = /var\s+require\s*=\s*createRequire\(\s*require\(/

async function rolldownStillShadowsRequire() {
  try {
    const { rolldown } = await import("rolldown")

    const bundle = await rolldown({
      input: "probe",
      platform: "node",
      logLevel: "silent",
      plugins: [
        {
          name: "probe",
          resolveId: (id) => (id === "probe" ? id : null),
          load: (id) => (id === "probe" ? PROBE : null),
        },
      ],
    })

    const { output } = await bundle.generate({ format: "cjs" })
    await bundle.close()

    return SHADOWED_REQUIRE.test(output[0].code)
  } catch {
    return undefined
  }
}

export function renameEmscriptenNodeRequire() {
  return {
    name: "rename-emscripten-node-require",

    async buildStart() {
      const stillBroken = await rolldownStillShadowsRequire()

      if (stillBroken === undefined) {
        this.warn(
          "rename-emscripten-node-require: could not probe rolldown, so whether this workaround is still needed is unknown. See https://github.com/rolldown/rolldown/pull/10655",
        )

        return
      }

      if (!stillBroken) {
        this.error(
          "rename-emscripten-node-require: rolldown no longer shadows the injected `require`, so this workaround is obsolete. " +
            "Delete `libherb-plugin.mjs` and its use in `rolldown.config.mjs`, then rebuild and check that `dist/herb-node-wasm.cjs` still loads. " +
            "See https://github.com/rolldown/rolldown/pull/10655",
        )
      }
    },

    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("/build/libherb.js")) return

      const declarations =
        code.match(/var\s+require\s*=\s*createRequire\(/g) ?? []
      const calls = code.match(/\brequire\("node:/g) ?? []

      if (declarations.length !== 1 || calls.length === 0) {
        throw new Error(
          `rename-emscripten-node-require: expected 1 require declaration and at least 1 require("node:…") call in ${id}, ` +
            `found ${declarations.length} and ${calls.length}. The generated output changed, so this workaround needs revisiting.`,
        )
      }

      return {
        code: code
          .replace(
            /var\s+require\s*=\s*createRequire\(/g,
            `var ${RENAMED} = createRequire(`,
          )
          .replace(/\brequire\("node:/g, `${RENAMED}("node:`),
        map: null,
      }
    },
  }
}
