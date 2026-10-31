// Entry point for the standalone `herb-lint` binary, compiled with `bun build --compile`.
// It's compiled together with ./lint-worker.ts, which is embedded next to this file,
// where FileProcessor looks for the worker.

import { CLI } from "../cli.js"
import { registerEmbeddedPackages } from "./embedded-packages.js"

registerEmbeddedPackages()

const cli = new CLI()
cli.run()
