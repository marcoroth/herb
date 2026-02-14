// @ts-check
import * as fs from 'fs/promises'
import * as path from 'path'
import { pathToFileURL } from 'url'
import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import { createJiti, type Jiti } from 'jiti'
import postcss from 'postcss'
// @ts-ignore
import postcssImport from 'postcss-import'
import type { RequiredConfig } from 'tailwindcss/types/config.js'
import { expiringMap } from './expiring-map.js'
import { resolveCssFrom, resolveJsFrom } from './resolve'
import type { ContextContainer, SortTailwindClassesOptions } from './types'

let sourceToPathMap = new Map<string, string | null>()
let sourceToEntryMap = new Map<string, string | null>()
let pathToContextMap = expiringMap<string | null, ContextContainer>(10_000)

export async function getTailwindConfig(
  options: SortTailwindClassesOptions = {},
): Promise<ContextContainer> {
  let pkgName = 'tailwindcss'

  let key = [
    options.baseDir ?? process.cwd(),
    options.tailwindStylesheet ?? '',
    options.tailwindConfig ?? '',
    pkgName,
  ].join(':')

  let baseDir = getBaseDir(options)

  // Map the source file to it's associated Tailwind config file
  let configPath = sourceToPathMap.get(key)
  if (configPath === undefined) {
    configPath = getConfigPath(options, baseDir)
    sourceToPathMap.set(key, configPath)
  }

  let entryPoint = sourceToEntryMap.get(key)
  if (entryPoint === undefined) {
    entryPoint = getEntryPoint(options, baseDir)
    sourceToEntryMap.set(key, entryPoint)
  }

  // Now see if we've loaded the Tailwind config file before (and it's still valid)
  let contextKey = `${pkgName}:${configPath}:${entryPoint}`
  let existing = pathToContextMap.get(contextKey)
  if (existing) {
    return existing
  }

  // By this point we know we need to load the Tailwind config file
  let result = await loadTailwindConfig(
    baseDir,
    pkgName,
    configPath,
    entryPoint,
  )

  pathToContextMap.set(contextKey, result)

  return result
}

function getBaseDir(options: SortTailwindClassesOptions): string {
  if (options.baseDir) {
    return options.baseDir
  }

  return process.cwd()
}

async function loadTailwindConfig(
  baseDir: string,
  pkgName: string,
  tailwindConfigPath: string | null,
  entryPoint: string | null,
): Promise<ContextContainer> {
  let createContext: any
  let generateRules: any
  let resolveConfig: any
  let loadConfig: any
  let tailwindConfig: RequiredConfig = { content: [] }

  try {
    let pkgPath = resolveJsFrom(baseDir, pkgName)
    let pkgJsonPath: string

    try {
      const Module = require('module')
      const requireFromBase = Module.createRequire(path.join(baseDir, 'index.js'))

      pkgJsonPath = requireFromBase.resolve(`${pkgName}/package.json`)
    } catch {
      // Fallback: assume pkgPath is in a subdirectory of the package
      // Let's walk up until we find package.json
      let currentDir = path.dirname(pkgPath)

      while (currentDir !== path.dirname(currentDir)) {
        const candidatePkgJson = path.join(currentDir, 'package.json')

        try {
          require('fs').accessSync(candidatePkgJson)
          pkgJsonPath = candidatePkgJson
          break
        } catch {}

        currentDir = path.dirname(currentDir)
      }

      if (!pkgJsonPath!) {
        throw new Error('Could not find Tailwind CSS package.json')
      }
    }

    let pkgDir = path.dirname(pkgJsonPath)

    try {
      let v4 = await loadV4(baseDir, pkgDir, pkgName, entryPoint)
      if (v4) {
        return v4
      }
    } catch (err) {
      // V4 loading failed, will try v3 below
    }

    resolveConfig = require(path.join(pkgDir, 'resolveConfig'))
    createContext = require(
      path.join(pkgDir, 'lib/lib/setupContextUtils'),
    ).createContext
    generateRules = require(
      path.join(pkgDir, 'lib/lib/generateRules'),
    ).generateRules

    // Prior to `tailwindcss@3.3.0` this won't exist so we load it last
    loadConfig = require(path.join(pkgDir, 'loadConfig'))
  } catch (err: any) {
    // Tailwind isn't installed or loading failed, will use defaults
  }

  if (tailwindConfigPath) {
    try {
      clearModule(tailwindConfigPath)
      const loadedConfig = loadConfig(tailwindConfigPath)
      tailwindConfig = loadedConfig.default ?? loadedConfig
    } catch (error) {
      console.warn(`Failed to load Tailwind config from ${tailwindConfigPath}:`, error)
    }
  }

  if (!resolveConfig || !createContext || !generateRules) {
    return {
      context: null,
      generateRules: null,
    }
  }

  tailwindConfig.content = ['no-op']

  let context = createContext(resolveConfig(tailwindConfig))

  return {
    context,
    generateRules,
  }
}

/**
 * Create a loader function that can load plugins and config files relative to
 * the CSS file that uses them. However, we don't want missing files to prevent
 * everything from working so we'll let the error handler decide how to proceed.
 */
function createLoader<T>({
  legacy,
  jiti,
  filepath,
  onError,
}: {
  legacy: boolean
  jiti: Jiti
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = resolveJsFrom(base, id)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await jiti.import(url.href, { default: true })
    } catch (error) {
      return onError(id, error, resourceType)
    }
  }

  if (legacy) {
    let baseDir = path.dirname(filepath)
    return (id: string) => loadFile(id, baseDir, 'module')
  }

  return async (id: string, base: string, resourceType: string) => {
    return {
      base,
      module: await loadFile(id, base, resourceType),
    }
  }
}

async function loadV4(
  baseDir: string,
  pkgDir: string,
  pkgName: string,
  entryPoint: string | null,
) {
  // Import Tailwind — if this is v4 it'll have APIs we can use directly
  let pkgPath = resolveJsFrom(baseDir, pkgName)

  let tw = await import(pathToFileURL(pkgPath).toString())

  // This is not Tailwind v4
  if (!tw.__unstable__loadDesignSystem) {
    return null
  }

  // If the user doesn't define an entrypoint then we use the default theme
  entryPoint = entryPoint ?? `${pkgDir}/theme.css`

  // Create a Jiti instance that can be used to load plugins and config files
  let jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
  })

  let importBasePath = path.dirname(entryPoint)

  // Resolve imports in the entrypoint to a flat CSS tree
  let css = await fs.readFile(entryPoint, 'utf-8')

  // Determine if the v4 API supports resolving `@import`
  let supportsImports = false
  try {
    await tw.__unstable__loadDesignSystem('@import "./empty";', {
      loadStylesheet: () => {
        supportsImports = true
        return {
          base: importBasePath,
          content: '',
        }
      },
    })
  } catch {}

  if (!supportsImports) {
    let resolveImports = postcss([postcssImport()])
    let result = await resolveImports.process(css, { from: entryPoint })
    css = result.css
  }

  // Load the design system and set up a compatible context object that is
  // usable by the rest of the plugin
  let design = await tw.__unstable__loadDesignSystem(css, {
    base: importBasePath,

    // v4.0.0-alpha.25+
    loadModule: createLoader({
      legacy: false,
      jiti,
      filepath: entryPoint,
      onError: (id, err, resourceType) => {
        console.error(`Unable to load ${resourceType}: ${id}`, err)

        if (resourceType === 'config') {
          return {}
        } else if (resourceType === 'plugin') {
          return () => {}
        }
      },
    }),

    loadStylesheet: async (id: string, base: string) => {
      let resolved = resolveCssFrom(base, id)

      return {
        base: path.dirname(resolved),
        content: await fs.readFile(resolved, 'utf-8'),
      }
    },

    // v4.0.0-alpha.24 and below
    loadPlugin: createLoader({
      legacy: true,
      jiti,
      filepath: entryPoint,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      legacy: true,
      jiti,
      filepath: entryPoint,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  return {
    context: {
      getClassOrder: (classList: string[]) => design.getClassOrder(classList),
    },

    // Stubs that are not needed for v4
    generateRules: () => [],
  }
}

function getConfigPath(options: SortTailwindClassesOptions, baseDir: string): string | null {
  if (options.tailwindConfig) {
    if (options.tailwindConfig.endsWith('.css')) {
      return null
    }

    return path.resolve(baseDir, options.tailwindConfig)
  }

  let configPath: string | void = undefined
  try {
    configPath = escalade(baseDir, (_dir, names) => {
      if (names.includes('tailwind.config.js')) {
        return 'tailwind.config.js'
      }
      if (names.includes('tailwind.config.cjs')) {
        return 'tailwind.config.cjs'
      }
      if (names.includes('tailwind.config.mjs')) {
        return 'tailwind.config.mjs'
      }
      if (names.includes('tailwind.config.ts')) {
        return 'tailwind.config.ts'
      }
    })
  } catch {}

  if (configPath) {
    return configPath
  }

  return null
}

function getEntryPoint(options: SortTailwindClassesOptions, baseDir: string): string | null {
  if (options.tailwindStylesheet) {
    return path.resolve(baseDir, options.tailwindStylesheet)
  }

  if (options.tailwindConfig && options.tailwindConfig.endsWith('.css')) {
    console.warn(
      'Use the `tailwindStylesheet` option for v4 projects instead of `tailwindConfig`.',
    )

    return path.resolve(baseDir, options.tailwindConfig)
  }

  try {
    const commonPaths = [
      'app/assets/tailwind/application.css',
      'app/assets/stylesheets/application.tailwind.css',
      'app/assets/stylesheets/application.css',
      'src/styles/tailwind.css',
      'src/tailwind.css',
      'styles/tailwind.css',
      'tailwind.css',
      'app.css',
      'src/app.css',
    ]

    for (const cssPath of commonPaths) {
      const fullPath = path.resolve(baseDir, cssPath)
      try {
        require('fs').accessSync(fullPath, require('fs').constants.R_OK)
        return fullPath
      } catch {
        // File doesn't exist or isn't readable, continue to next path
      }
    }
  } catch {}

  return null
}
