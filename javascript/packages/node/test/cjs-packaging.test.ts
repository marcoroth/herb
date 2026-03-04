import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { createRequire } from "module"
import { describe, test, expect, beforeAll, afterAll } from "vitest"

const require = createRequire(import.meta.url)

const distDir = path.resolve(__dirname, "../dist")
const typesDir = path.join(distDir, "types")
const cjsPath = path.join(distDir, "herb-node.cjs")
const esmPath = path.join(distDir, "herb-node.esm.js")
const cjsTypesPath = path.join(typesDir, "index-cjs.d.cts")
const esmTypesPath = path.join(typesDir, "index-esm.d.mts")
const packageJsonPath = path.resolve(__dirname, "../package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))

describe("CJS build output", () => {
  const content = fs.readFileSync(cjsPath, "utf-8")

  test("dist/herb-node.cjs exists", () => {
    expect(fs.existsSync(cjsPath)).toBe(true)
  })

  test("does not contain unresolved local require for node-backend", () => {
    expect(content.includes('require("./node-backend')).toBe(false)
    expect(content.includes("require('./node-backend")).toBe(false)
  })

  test("bundles HerbBackendNode class inline", () => {
    expect(content.includes("class HerbBackendNode")).toBe(true)
  })

  test("uses promise factory pattern, not raw promise", () => {
    expect(content.includes("() => new Promise")).toBe(true)
    expect(/new HerbBackendNode\(new Promise/.test(content)).toBe(false)
  })

  test("re-exports @herb-tools/core", () => {
    expect(content.includes("@herb-tools/core")).toBe(true)
  })
})

describe("ESM build output", () => {
  const content = fs.readFileSync(esmPath, "utf-8")

  test("dist/herb-node.esm.js exists", () => {
    expect(fs.existsSync(esmPath)).toBe(true)
  })

  test("bundles HerbBackendNode class inline", () => {
    expect(content.includes("class HerbBackendNode")).toBe(true)
  })

  test("does not contain unresolved local import for node-backend", () => {
    expect(/from\s+['"]\.\/node-backend/.test(content)).toBe(false)
  })

  test("uses promise factory pattern, not raw promise", () => {
    expect(content.includes("() => new Promise")).toBe(true)
    expect(/new HerbBackendNode\(new Promise/.test(content)).toBe(false)
  })

  test("exports Herb and HerbBackendNode in export statement", () => {
    expect(/export\s*\{[^}]*Herb[^}]*HerbBackendNode[^}]*\}/.test(content)).toBe(true)
  })

  test("re-exports @herb-tools/core with export *", () => {
    expect(/export\s+\*\s+from\s+['"]@herb-tools\/core['"]/.test(content)).toBe(true)
  })
})

describe("CJS and ESM parity", () => {
  const cjsContent = fs.readFileSync(cjsPath, "utf-8")
  const esmContent = fs.readFileSync(esmPath, "utf-8")

  test("both use promise factory pattern", () => {
    expect(cjsContent.includes("() => new Promise")).toBe(true)
    expect(esmContent.includes("() => new Promise")).toBe(true)
  })

  test("both bundle HerbBackendNode inline", () => {
    expect(cjsContent.includes("class HerbBackendNode")).toBe(true)
    expect(esmContent.includes("class HerbBackendNode")).toBe(true)
  })

  test("neither has unresolved node-backend reference", () => {
    expect(cjsContent.includes("./node-backend")).toBe(false)
    expect(/from\s+['"]\.\/node-backend/.test(esmContent)).toBe(false)
  })
})

describe("CJS type declarations", () => {
  const content = fs.readFileSync(cjsTypesPath, "utf-8")

  test("file exists", () => {
    expect(fs.existsSync(cjsTypesPath)).toBe(true)
  })

  test("is not empty or stub export", () => {
    expect(content.trim()).not.toBe("")
    expect(content.trim()).not.toBe("export {};")
  })

  test("has full expected content", () => {
    expect(content).toBe(
      [
        'export * from "@herb-tools/core";',
        'export { HerbBackendNode } from "./node-backend.js";',
        'import { HerbBackendNode } from "./node-backend.js";',
        "/**",
        " * An instance of the `Herb` class using a Node.js backend.",
        " * This loads `libherb` in a Node.js C++ native extension.",
        " */",
        "export declare const Herb: HerbBackendNode;",
        "",
      ].join("\n"),
    )
  })
})

describe("ESM type declarations", () => {
  const content = fs.readFileSync(esmTypesPath, "utf-8")

  test("file exists", () => {
    expect(fs.existsSync(esmTypesPath)).toBe(true)
  })

  test("is not empty or stub export", () => {
    expect(content.trim()).not.toBe("")
    expect(content.trim()).not.toBe("export {};")
  })

  test("has full expected content", () => {
    expect(content).toBe(
      [
        'export * from "@herb-tools/core";',
        'import { HerbBackendNode } from "./node-backend.js";',
        "/**",
        " * An instance of the `Herb` class using a Node.js backend.",
        " * This loads `libherb` in a Node.js C++ native extension.",
        " */",
        "declare const Herb: HerbBackendNode;",
        "export { Herb, HerbBackendNode };",
        "",
      ].join("\n"),
    )
  })
})

describe("package.json exports map", () => {
  test("'.' export has nested import/require conditions", () => {
    expect(packageJson.exports["."]).toEqual({
      import: {
        types: "./dist/types/index-esm.d.mts",
        default: "./dist/herb-node.esm.js",
      },
      require: {
        types: "./dist/types/index-cjs.d.cts",
        default: "./dist/herb-node.cjs",
      },
    })
  })

  test("main field points to CJS bundle", () => {
    expect(packageJson.main).toBe("./dist/herb-node.cjs")
  })

  test("module field points to ESM bundle", () => {
    expect(packageJson.module).toBe("./dist/herb-node.esm.js")
  })

  test("types field points to ESM type declarations", () => {
    expect(packageJson.types).toBe("./dist/types/index-esm.d.mts")
  })

  test("all exported files exist on disk", () => {
    const root = path.resolve(__dirname, "..")

    const files = [
      packageJson.exports["."].import.types,
      packageJson.exports["."].import.default,
      packageJson.exports["."].require.types,
      packageJson.exports["."].require.default,
    ]

    for (const file of files) {
      expect(fs.existsSync(path.resolve(root, file))).toBe(true)
    }
  })
})

describe("CJS runtime require", () => {
  let cjsModule: Record<string, unknown>

  beforeAll(async () => {
    cjsModule = require(cjsPath)
    await (cjsModule.Herb as any).load()
  })

  test("can be required without errors", () => {
    expect(cjsModule).toBeDefined()
  })

  test("exports Herb as an instance of HerbBackendNode", () => {
    expect(cjsModule.Herb).toBeDefined()
    expect(cjsModule.Herb).toBeInstanceOf(cjsModule.HerbBackendNode as any)
  })

  test("exports HerbBackendNode as a class", () => {
    expect(typeof cjsModule.HerbBackendNode).toBe("function")
  })

  test("exports HerbBackend from @herb-tools/core", () => {
    expect(typeof cjsModule.HerbBackend).toBe("function")
  })

  test("exports Visitor from @herb-tools/core", () => {
    expect(typeof cjsModule.Visitor).toBe("function")
  })

  test("exports ParseResult from @herb-tools/core", () => {
    expect(typeof cjsModule.ParseResult).toBe("function")
  })

  test("exports Node from @herb-tools/core", () => {
    expect(typeof cjsModule.Node).toBe("function")
  })

  test("HerbBackendNode extends HerbBackend", () => {
    const node = cjsModule.HerbBackendNode as any
    const backend = cjsModule.HerbBackend as any

    expect(new node(() => Promise.resolve({})) instanceof backend).toBe(true)
  })

  test("Herb.parse is a function", () => {
    expect(typeof (cjsModule.Herb as any).parse).toBe("function")
  })

  test("Herb.parse works on a simple template", () => {
    const herb = cjsModule.Herb as any
    const result = herb.parse("<div>hello</div>")

    expect(result).toBeDefined()
    expect(result.errors).toEqual([])
  })

  test("Herb.extractRuby is a function", () => {
    expect(typeof (cjsModule.Herb as any).extractRuby).toBe("function")
  })

  test("Herb.extractRuby works on a simple template", () => {
    const herb = cjsModule.Herb as any
    const result = herb.extractRuby('<%= "hello" %>')

    expect(result).toBe('    "hello"  ;')
  })

  test("Herb.extractHTML is a function", () => {
    expect(typeof (cjsModule.Herb as any).extractHTML).toBe("function")
  })

  test("Herb.extractHTML works on a simple template", () => {
    const herb = cjsModule.Herb as any
    const result = herb.extractHTML('<div><%= "hello" %></div>')

    expect(result).toBe("<div>              </div>")
  })
})

describe("CJS project integration", () => {
  const projectDir = path.resolve(__dirname, "../tmp/test-cjs-project")
  const packageRoot = path.resolve(__dirname, "..")

  beforeAll(() => {
    fs.mkdirSync(projectDir, { recursive: true })

    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "test-cjs-project", private: true }, null, 2),
    )

    fs.mkdirSync(path.join(projectDir, "node_modules/@herb-tools"), { recursive: true })
    fs.symlinkSync(packageRoot, path.join(projectDir, "node_modules/@herb-tools/node"))

    const corePackagePath = path.resolve(packageRoot, "node_modules/@herb-tools/core")
    fs.symlinkSync(corePackagePath, path.join(projectDir, "node_modules/@herb-tools/core"))

    const nodePregypPath = path.resolve(packageRoot, "node_modules/@mapbox")
    fs.mkdirSync(path.join(projectDir, "node_modules/@mapbox"), { recursive: true })
    fs.symlinkSync(
      path.join(nodePregypPath, "node-pre-gyp"),
      path.join(projectDir, "node_modules/@mapbox/node-pre-gyp"),
    )
  })

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true })
  })

  test("require('@herb-tools/node') works in a CJS project", () => {
    const script = `
      const herb = require("@herb-tools/node");
      const result = JSON.stringify({
        hasHerb: typeof herb.Herb === "object",
        hasHerbBackendNode: typeof herb.HerbBackendNode === "function",
        hasHerbBackend: typeof herb.HerbBackend === "function",
        hasVisitor: typeof herb.Visitor === "function",
        hasParseResult: typeof herb.ParseResult === "function",
        hasNode: typeof herb.Node === "function",
        herbIsInstanceOfBackendNode: herb.Herb instanceof herb.HerbBackendNode,
        herbIsInstanceOfHerbBackend: herb.Herb instanceof herb.HerbBackend,
      });
      process.stdout.write(result);
    `

    const output = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: projectDir,
      encoding: "utf-8",
    })

    expect(JSON.parse(output)).toEqual({
      hasHerb: true,
      hasHerbBackendNode: true,
      hasHerbBackend: true,
      hasVisitor: true,
      hasParseResult: true,
      hasNode: true,
      herbIsInstanceOfBackendNode: true,
      herbIsInstanceOfHerbBackend: true,
    })
  })

  test("require('@herb-tools/node') can parse HTML in a CJS project", () => {
    const script = `
      const herb = require("@herb-tools/node");
      herb.Herb.load().then(() => {
        const result = herb.Herb.parse("<div>hello</div>");
        process.stdout.write(JSON.stringify({
          errorsLength: result.errors.length,
          warningsLength: result.warnings.length,
          hasParsedValue: result.value !== undefined && result.value !== null,
        }));
      });
    `

    const output = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: projectDir,
      encoding: "utf-8",
    })

    expect(JSON.parse(output)).toEqual({
      errorsLength: 0,
      warningsLength: 0,
      hasParsedValue: true,
    })
  })

  test("require('@herb-tools/node') can extract Ruby in a CJS project", () => {
    const script = `
      const herb = require("@herb-tools/node");
      herb.Herb.load().then(() => {
        const result = herb.Herb.extractRuby('<%= "hello" %>');
        process.stdout.write(result);
      });
    `

    const output = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: projectDir,
      encoding: "utf-8",
    })

    expect(output).toBe('    "hello"  ;')
  })
})
