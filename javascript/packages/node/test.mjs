import { Herb } from "@herb-tools/node"

await Herb.load()

console.log(Herb)
console.log(Herb.version)

console.log(Herb.lex("hello world"))
console.log(Herb.lexFile("./test.html.erb"))
console.log(Herb.parse("hello world"))
console.log(Herb.parseFile("./test.html.erb"))
