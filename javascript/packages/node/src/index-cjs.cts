const path = require("path")
const binary = require("@mapbox/node-pre-gyp")

const { Visitor } = require("@herb-tools/core")
const { HerbBackendNode } = require("./node-backend.js")

const packagePath = path.resolve(__dirname, "../package.json")
const libherbPath = binary.find(packagePath)
const libHerbBinary = require(libherbPath)

/**
 * An instance of the `Herb` class using a Node.js backend.
 * This loads `libherb` in a Node.js C++ native extension.
 */
const Herb = new HerbBackendNode(
  new Promise((resolve, _reject) => resolve(libHerbBinary)),
)

module.exports = {
  Herb: Herb,
  Visitor: Visitor,
}
