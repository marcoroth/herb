const path = require("path")
const binary = require("@mapbox/node-pre-gyp")

const { Herb } = require("@herb-tools/core")
const { createBackend } = require("./libherb.js")

const packagePath = path.resolve(__dirname, "../package.json")
const libherbPath = binary.find(packagePath)

const libHerbBinary = require(libherbPath)
const backend = createBackend(libHerbBinary)

const herb = new Herb(backend)

module.exports = {
  Herb: herb,
}
