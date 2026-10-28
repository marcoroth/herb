// Worker entry point for the standalone `herb-lint` binary. Each worker runs in its
// own module context, so the embedded packages need to be registered here as well.

import { registerEmbeddedPackages } from "./embedded-packages.js"

registerEmbeddedPackages()

await import("../cli/lint-worker.js")
