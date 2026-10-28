import * as core from "@herb-tools/core"
import * as printer from "@herb-tools/printer"
import * as rewriter from "@herb-tools/rewriter/loader"

import * as formatter from "../index.js"

/**
 * The standalone binaries ship without a node_modules folder, so custom rewriters in
 * `.herb/rewriters` that import Herb packages by name are served the copies that are
 * embedded in the binary. Only has an effect when running under Bun.
 *
 * Both rewriter entry points are served the loader's copy, the one the formatter uses to
 * check that custom rewriters extend ASTRewriter or StringRewriter.
 */
export function registerEmbeddedPackages(): void {
  const bun = (globalThis as any).Bun

  if (!bun?.plugin) return

  const packages: Record<string, object> = {
    "@herb-tools/core": core,
    "@herb-tools/formatter": formatter,
    "@herb-tools/printer": printer,
    "@herb-tools/rewriter": rewriter,
    "@herb-tools/rewriter/loader": rewriter,
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
