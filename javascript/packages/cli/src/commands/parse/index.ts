import { CLI } from "./cli.js"

export async function handle() {
  const cli = new CLI()
  await cli.run()
}
