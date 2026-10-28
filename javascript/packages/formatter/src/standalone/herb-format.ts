// Entry point for the standalone `herb-format` binary, compiled with `bun build --compile`.

import { CLI } from "../cli.js"
import { registerEmbeddedPackages } from "./embedded-packages.js"

registerEmbeddedPackages()

const cli = new CLI()
cli.run()
