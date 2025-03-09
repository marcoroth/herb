import path from "path"
import binary from "@mapbox/node-pre-gyp"

import { createRequire } from "module"
import { fileURLToPath } from "url"

import { createBackend } from "./libherb.js"

import { Herb } from "@herb-tools/core"

import type { LibHerbBackend } from "@herb-tools/core"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const packagePath = path.resolve(__dirname, "../package.json")
const libherbPath = binary.find(packagePath)

const libHerbBinary = require(libherbPath)
const backend: LibHerbBackend = createBackend(libHerbBinary)

const herb = new Herb(backend)

export { herb as Herb }
