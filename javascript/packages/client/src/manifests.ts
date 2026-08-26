import { HERB_ATTRIBUTES } from "./attributes"

import type { StateManifest } from "./state"
import type { SlotType } from "./types"

export interface ManifestSlot {
  index: number
  type: SlotType
  attribute?: string
  collection?: number
}

export interface TemplateManifest {
  file: string
  identifier: string
  version: string
  slots: ManifestSlot[]
  names: Record<string, number>
  parts: Record<string, string[]>
  states: StateManifest | null
}

const CONTAINER = `template[${HERB_ATTRIBUTES.manifests}]`

function containers(root: Node, selector: string): HTMLTemplateElement[] {
  const found: HTMLTemplateElement[] = []

  if (root instanceof HTMLTemplateElement && root.matches(selector)) {
    found.push(root)
  }

  if (root instanceof Element || root instanceof DocumentFragment || root instanceof Document) {
    found.push(...root.querySelectorAll<HTMLTemplateElement>(selector))
  }

  return found
}

function parse(element: HTMLTemplateElement): unknown {
  const json = element.content.textContent ?? element.textContent ?? ""

  if (!json.trim()) {
    return null
  }

  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export class Manifests {
  #held = new Map<string, TemplateManifest>()

  adopt(root: Node): number {
    let taken = 0

    for (const element of containers(root, CONTAINER)) {
      const held = parse(element) as Record<string, unknown> | null

      for (const [identity, manifest] of Object.entries(held ?? {})) {
        if (this.#keep(identity, manifest)) {
          taken += 1
        }
      }

      element.remove()
    }

    return taken
  }

  get(file: string, version: string): TemplateManifest | null {
    return this.#held.get(`${file}:${version}`) ?? null
  }

  nameOf(file: string, version: string, name: string): number | null {
    return this.get(file, version)?.names[name] ?? null
  }

  partsOf(file: string, version: string, index: number): string[] | null {
    return this.get(file, version)?.parts[String(index)] ?? null
  }

  statesOf(file: string, version: string): StateManifest | null {
    return this.get(file, version)?.states ?? null
  }

  clear(): void {
    this.#held = new Map()
  }

  #keep(identity: string, manifest: unknown): boolean {
    if (!identity || !manifest || typeof manifest !== "object") {
      return false
    }

    if (this.#held.has(identity)) {
      return false
    }

    this.#held.set(identity, manifest as TemplateManifest)

    return true
  }
}
