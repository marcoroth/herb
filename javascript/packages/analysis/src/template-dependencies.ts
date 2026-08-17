import { helperExists } from "@herb-tools/core"

import { RubyDependencyCollector } from "./ruby-dependency-collector"
import { RenderCallCollector } from "./render-call-collector"

import type { DocumentNode, HerbBackend } from "@herb-tools/core"
import type { RenderCallDependency } from "./render-call-collector"

const PARSER_OPTIONS = { render_nodes: true, strict_locals: true, prism_nodes: true, prism_program: true, track_whitespace: true }

export interface TemplateDependencies {
  file: string
  instanceVariables: string[]
  constants: string[]
  localsDeclared: string[]
  localsReceived: Record<string, string>
  renderCalls: RenderCallDependency[]
  helperCalls: string[]
  unknownCalls: string[]
}

export interface DependencyOptions {
  customHelpers?: Iterable<string>
}

export function collectTemplateDependencies(backend: HerbBackend, file: string, source: string, options: DependencyOptions = {}): TemplateDependencies {
  const custom = new Set(options.customHelpers ?? [])
  const parsed = backend.parse(source, PARSER_OPTIONS)
  const document = parsed.value as DocumentNode

  const renders = new RenderCallCollector()
  renders.visit(document)

  const ruby = new RubyDependencyCollector()
  const program = document.prismNode

  if (program) {
    ruby.visit(program)
  }

  const helperCalls = new Set<string>()
  const unknownCalls = new Set<string>()

  for (const name of ruby.bareCalls) {
    if (helperExists(name) || custom.has(name)) {
      helperCalls.add(name)

      continue
    }

    if (name === "render") continue
    if (ruby.knownLocals.has(name)) continue
    if (name in renders.localsReceived) continue
    if (renders.localsDeclared.has(name)) continue

    unknownCalls.add(name)
  }

  return {
    file,
    instanceVariables: [...ruby.instanceVariables].sort(),
    constants: [...ruby.constants].sort(),
    localsDeclared: [...renders.localsDeclared].sort(),
    localsReceived: renders.localsReceived,
    renderCalls: renders.renderCalls,
    helperCalls: [...helperCalls].sort(),
    unknownCalls: [...unknownCalls].sort(),
  }
}
