import { Herb } from "@herb-tools/node-wasm"

await Herb.load()
console.log(`Version: ${Herb.version}`)

const result = Herb.parse('<div><%= "Hello" %></div>')
console.assert(result.errors.length === 0, "No parse errors")
console.assert(result.inspect().includes("@ DocumentNode (location: (1:0)-(1:25))"))
console.log(result.inspect())

const ruby = Herb.extractRuby('<div><%= "Hello" %></div>')
console.assert(ruby.includes('"Hello"'), "extractRuby works")

console.log("node-wasm works in Deno!")
