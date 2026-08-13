import type { TemplateDependencies } from "./template-dependencies"

export interface TemplateGraph {
  dependencies: Map<string, TemplateDependencies>
  filesForPartial(partialName: string): string[]
}

export function expressionReferences(expression: string | undefined, name: string): boolean {
  if (!expression || !name) return false
  if (name.startsWith("@")) return expression.includes(name)

  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(expression)
}

export function affectedTemplates(graph: TemplateGraph, entryPoint: string, state: string): string[] {
  const entry = graph.dependencies.get(entryPoint)
  if (!entry) return []

  if (!entry.instanceVariables.includes(state) && !entry.constants.includes(state)) {
    return []
  }

  const affected = new Set<string>([entryPoint])
  const carrying = new Map<string, Set<string>>([[entryPoint, new Set([state])]])
  const visited = new Set<string>()
  const queue = [entryPoint]

  while (queue.length > 0) {
    const file = queue.shift()!

    if (visited.has(file)) continue

    visited.add(file)

    const dependencies = graph.dependencies.get(file)
    if (!dependencies) continue

    const carried = [...(carrying.get(file) ?? [])]

    for (const call of dependencies.renderCalls) {
      const flowing = Object.entries(call.locals).filter(([, expression]) => carried.some(name => expressionReferences(expression, name))).map(([local]) => local)
      const collectionFlows = carried.some(name => expressionReferences(call.collection, name))

      if (flowing.length === 0 && !collectionFlows) {
        continue
      }

      for (const partialFile of graph.filesForPartial(call.partial)) {
        const names = carrying.get(partialFile) ?? new Set<string>()

        for (const local of flowing) {
          names.add(local)
        }

        if (collectionFlows) {
          names.add(itemNameFor(call.partial))
        }

        carrying.set(partialFile, names)

        if (!affected.has(partialFile)) {
          affected.add(partialFile)
          queue.push(partialFile)
        }
      }
    }
  }

  return [...affected].sort()
}

function itemNameFor(partialName: string): string {
  return partialName.split("/").pop() ?? partialName
}
