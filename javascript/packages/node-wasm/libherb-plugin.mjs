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
export function renameEmscriptenNodeRequire() {
  return {
    name: "rename-emscripten-node-require",
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
