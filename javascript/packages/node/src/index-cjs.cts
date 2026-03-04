export * from "@herb-tools/core"
export { HerbBackendNode } from "./node-backend.js"

import path from "path"
import binary from "@mapbox/node-pre-gyp"

const packagePath = path.resolve(__dirname, "../package.json")
const libherbPath = binary.find(packagePath)
const libHerbBinary = require(libherbPath)

import { HerbBackendNode } from "./node-backend.js"

/**
 * An instance of the `Herb` class using a Node.js backend.
 * This loads `libherb` in a Node.js C++ native extension.
 */
export const Herb = new HerbBackendNode(
  () => new Promise((resolve, _reject) => resolve(libHerbBinary)),
)
