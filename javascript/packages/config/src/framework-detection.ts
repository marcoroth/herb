import path from "path"

import { promises as fs } from "fs"

import type { Framework, PrismNode, PrismParseResult } from "@herb-tools/core"

export const GEMFILE_NAMES = ["Gemfile", "gems.rb"]

export const FRAMEWORK_GEMS: Record<string, Framework> = {
  rails: "actionview",
  actionview: "actionview",
  hanami: "hanami",
  "hanami-view": "hanami",
  sinatra: "sinatra",
}

const FRAMEWORK_PRECEDENCE: Framework[] = ["actionview", "hanami", "sinatra"]

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  ruby: "Ruby",
  actionview: "Action View",
  hanami: "Hanami",
  sinatra: "Sinatra",
}

export const FRAMEWORK_DESCRIPTIONS: Record<Framework, string> = {
  ruby: "plain ERB templates, with no framework helpers in scope",
  actionview: "Action View templates, with their helpers, partials, and strict locals",
  hanami: "Hanami views, with their parts and helpers",
  sinatra: "Sinatra templates, with their helpers",
}

export interface RubySourceParser {
  parseRuby(source: string): PrismParseResult
}

export interface FrameworkDetection {
  framework: Framework
  gem: string
  gemfilePath: string
}

function collectGems(node: PrismNode, gems: string[]): void {
  if (!node || typeof node.childNodes !== "function") return

  if (node.constructor?.name === "CallNode" && node.name === "gem" && !node.receiver) {
    const [firstArgument] = node.arguments_?.arguments_ ?? []
    const name = gemName(firstArgument)

    if (name) {
      gems.push(name)
    }
  }

  for (const child of node.childNodes()) {
    collectGems(child, gems)
  }
}

function gemName(node: PrismNode | undefined): string | undefined {
  const type = node?.constructor?.name

  if (type !== "StringNode" && type !== "SymbolNode") return undefined

  return node.unescaped?.value
}

export function gemsFromGemfile(source: string, parser: RubySourceParser): string[] {
  let result: PrismParseResult

  try {
    result = parser.parseRuby(source)
  } catch {
    return []
  }

  const program = result.value

  if (!program) return []

  const gems: string[] = []

  collectGems(program, gems)

  return gems
}

export async function detectFrameworkFromGemfile(
  projectPath: string,
  parser: RubySourceParser
): Promise<FrameworkDetection | undefined> {
  for (const gemfileName of GEMFILE_NAMES) {
    const gemfilePath = path.join(projectPath, gemfileName)

    let source: string

    try {
      source = await fs.readFile(gemfilePath, "utf8")
    } catch {
      continue
    }

    const gems = gemsFromGemfile(source, parser)
    const frameworks = new Map<Framework, string>()

    for (const gem of gems) {
      const framework = FRAMEWORK_GEMS[gem]

      if (framework && !frameworks.has(framework)) {
        frameworks.set(framework, gem)
      }
    }

    for (const framework of FRAMEWORK_PRECEDENCE) {
      const gem = frameworks.get(framework)

      if (gem) {
        return { framework, gem, gemfilePath }
      }
    }

    return undefined
  }

  return undefined
}
