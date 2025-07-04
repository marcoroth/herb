import { CLI } from "./cli.js"

const cli = new CLI()
cli.run().catch(console.error)
