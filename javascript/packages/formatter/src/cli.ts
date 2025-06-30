import { readFileSync } from "fs"
import { Herb } from "@herb-tools/node"
import { Formatter } from "./formatter.js"
import { name, version } from "../package.json"

export class CLI {
  private usage = `
  Usage: herb-formatter [file] [options]

  Arguments:
    file             File to format (use '-' or omit for stdin)

  Options:
    -h, --help       show help
    -v, --version    show version

  Examples:
    herb-formatter templates/index.html.erb
    cat template.html.erb | herb-formatter
    herb-formatter - < template.html.erb
`

  async run() {
    const args = process.argv.slice(2)

    if (args.includes("--help") || args.includes("-h")) {
      console.log(this.usage)
      process.exit(0)
    }

    try {
      await Herb.load()

      if (args.includes("--version") || args.includes("-v")) {
        console.log("Versions:")
        console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
        process.exit(0)
      }

      let source: string

      // Find the first non-flag argument (the file)
      const file = args.find(arg => !arg.startsWith("-"))

      // Read from file or stdin
      if (file && file !== "-") {
        source = readFileSync(file, "utf-8")
      } else {
        source = await this.readStdin()
      }

      const formatter = new Formatter(Herb)
      const result = formatter.format(source)
      process.stdout.write(result)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  }

  private async readStdin(): Promise<string> {
    const chunks: Buffer[] = []

    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }

    return Buffer.concat(chunks).toString("utf8")
  }
}
