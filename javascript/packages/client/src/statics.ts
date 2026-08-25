/**
 * What a template parked for markup the page has not rendered yet.
 *
 * A template compiled in client mode ships the branches a conditional did not take and the shape
 * of a row a collection has none of, keyed by the slot they belong to. The store holds one set per
 * template, replaced whenever a newer version of that template arrives, and hands back a copy
 * filled with whatever values it is given.
 */

import { HERB_ATTRIBUTES } from "./attributes"

import { attributeParts, blankSlots, fillSlots, parkedBranches } from "./fragments"
import { numericBranch, partsKey } from "./markers"
import { staticsElements } from "./anchors"
import { parseStaticsIdentity } from "./markers"

import type { AttributeParts, FragmentMap, RenderMode, SlotValues, StaticsIdentity } from "./types"

interface Parked {
  version: string
  fragments: FragmentMap
  parts: Map<number, AttributeParts | null>
}

export class Statics {
  #held = new Map<string, Parked>()

  park(identity: StaticsIdentity, key: string, fragment: DocumentFragment): boolean {
    const { file, version } = identity
    const held = this.#held.get(file)

    let parked: Parked = { version, fragments: new Map(), parts: new Map() }

    if (held && held.version === version) {
      parked = held
    }

    this.#held.set(file, parked)

    if (parked.fragments.has(key)) {
      return false
    }

    parked.fragments.set(key, fragment)

    return true
  }

  adopt(root: Node): void {
    for (const element of staticsElements(root)) {
      const identity = parseStaticsIdentity(element.getAttribute(HERB_ATTRIBUTES.region) ?? "")

      if (!identity) {
        continue
      }

      for (const [key, fragment] of parkedBranches(element)) {
        this.park(identity, key, fragment)
      }

      element.remove()
    }
  }

  parked(file: string, key: string): DocumentFragment | null {
    return this.#held.get(file)?.fragments.get(key) ?? null
  }

  keys(file: string): string[] {
    return [...(this.#held.get(file)?.fragments.keys() ?? [])]
  }

  branches(file: string, slot: number): number[] {
    const prefix = `${slot}:`

    return this.keys(file)
      .filter((key) => key.startsWith(prefix))
      .map((key) => numericBranch(key.slice(prefix.length)))
      .filter((branch): branch is number => branch !== null)
      .sort((left, right) => left - right)
  }

  mode(file: string, slot?: number): RenderMode {
    if (slot === undefined) {
      return this.keys(file).length > 0 ? "client" : "server"
    }

    return this.branches(file, slot).length > 0 ? "client" : "server"
  }

  parts(file: string, index: number): AttributeParts | null {
    const held = this.#held.get(file)

    if (!held) {
      return null
    }

    const cached = held.parts.get(index)

    if (cached !== undefined) {
      return cached
    }

    const parsed = attributeParts(held.fragments.get(partsKey(index)) ?? null)

    held.parts.set(index, parsed)

    return parsed
  }

  materialize(file: string, key: string, dynamics: SlotValues = {}): DocumentFragment | null {
    const parked = this.parked(file, key)

    if (!parked) {
      return null
    }

    const copy = parked.cloneNode(true) as DocumentFragment

    fillSlots(copy, dynamics, false, (index) => this.parts(file, index))

    return copy
  }

  blanked(fragment: DocumentFragment): DocumentFragment {
    blankSlots(fragment)

    return fragment
  }

  clear(): void {
    this.#held = new Map()
  }
}
