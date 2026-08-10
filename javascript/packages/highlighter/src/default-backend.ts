import type { HerbBackend } from "@herb-tools/core"

export async function loadDefaultBackend(): Promise<HerbBackend> {
  const { Herb } = await import("@herb-tools/node-wasm")

  if (!Herb) {
    throw new Error(
      "No default Herb backend is available in this environment. Pass a HerbBackend instance to the constructor, e.g. `Herb` from `@herb-tools/browser`.",
    )
  }

  return Herb
}
