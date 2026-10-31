import * as core from "@herb-tools/core"
import * as printer from "@herb-tools/printer"
import * as rewriter from "@herb-tools/rewriter"

import * as linter from "../index.js"

/**
 * The standalone binaries ship without a node_modules folder, so custom rules in
 * `.herb/rules` that import Herb packages by name are served the copies that are
 * embedded in the binary. Only has an effect when running under Bun.
 */
export function registerEmbeddedPackages(): void {
  const bun = (globalThis as any).Bun

  if (!bun?.plugin) return

  const packages: Record<string, object> = {
    "@herb-tools/core": core,
    "@herb-tools/linter": linter,
    "@herb-tools/printer": printer,
    "@herb-tools/rewriter": rewriter,
  }

  bun.plugin({
    name: "herb-embedded-packages",
    setup(build: any) {
      for (const [name, exports] of Object.entries(packages)) {
        build.module(name, () => ({ exports, loader: "object" }))
      }
    },
  })
}
