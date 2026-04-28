export * from "@herb-tools/core"

import path from "path"
import binary from "@mapbox/node-pre-gyp"

import { createRequire } from "module"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const packagePath = path.resolve(__dirname, "../package.json")
const libherbPath = binary.find(packagePath)

const libHerbBinary = require(libherbPath)

import { HerbBackendNode } from "./node-backend.js"

/**
 * An instance of the `Herb` class using a Node.js backend.
 * This loads `libherb` in a Node.js C++ native extension.
 */
const Herb = new HerbBackendNode(
  () => new Promise((resolve, _reject) => resolve(libHerbBinary)),
)

export { Herb, HerbBackendNode }
