import { Herb } from "@herb-tools/core"
import { backend } from "./libherb.js"

const herb = new Herb(backend)

export { herb as Herb }
