import dedent from "dedent"
import pc from "picocolors"

import * as fs from "fs/promises"
import * as path from "path"

import { Config, addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "@herb-tools/config"

export class CLI {
  async run() {
    const args = process.argv.slice(2)

    if (args[0] === "config") {
      args.shift()
    }

    const command = args[0]

    if (!command || command === "--help" || command === "-h") {
      this.showHelp()

      return
    }

    if (command === "--version" || command === "-v") {
      console.log((await import("@herb-tools/config/package.json")).version)

      return
    }

    switch (command) {
      case "show":
        await this.showConfig(args.slice(1))
        break

      case "validate":
        await this.validateConfig(args.slice(1))
        break

      case "init":
        await this.initConfig(args.slice(1))
        break

      case "path":
        await this.showPath(args.slice(1))
        break

      default:
        console.error(pc.red(`Unknown command: ${command}`))
        console.error(`Run ${pc.cyan("herb config --help")} for usage information`)
        process.exit(1)
    }
  }

  private showHelp() {
    console.log(dedent`
      Usage: herb config <command> [options]

      Commands:
        show       ········ Display the current Herb configuration
        validate   ········ Validate .herb.yml configuration file
        init       ········ Create a .herb.yml configuration file
        path       ········ Show path to .herb.yml configuration file

      Options:
        -h, --help ········ Display usage information
        -v, --version ····· Display version information
        --raw      ········ Show raw YAML content (for 'show' command)

      Examples:
        herb config show                 # Show configuration summary
        herb config show --raw           # Show raw YAML file
        herb config validate             # Validate .herb.yml
        herb config init                 # Create .herb.yml in current directory
        herb config path                 # Show path to .herb.yml
    `)
  }

  private async showConfig(args: string[]) {
    try {
      const projectPath = args.includes("--project")
        ? args[args.indexOf("--project") + 1]
        : process.cwd()

      const showRaw = args.includes("--raw")

      const config = await Config.load(projectPath, { silent: true })

      if (!config) {
        console.error(pc.yellow("⚠ No .herb.yml configuration file found"))
        console.error(`Run ${pc.cyan("herb config init")} to create one`)
        process.exit(1)
      }

      try {
        await fs.access(config.path)
      } catch {
        console.error(pc.yellow("⚠ No .herb.yml configuration file found"))
        console.error(`Run ${pc.cyan("herb config init")} to create one`)
        process.exit(1)
      }

      if (showRaw) {
        console.log(pc.green("✓") + " Configuration file: " + pc.dim(config.path))
        console.log()
        const yamlContent = await fs.readFile(config.path, "utf-8")
        console.log(yamlContent)
      } else {
        this.showConfigSummary(config)
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        console.error(pc.yellow("⚠ No .herb.yml configuration file found"))
        console.error(`Run ${pc.cyan("herb config init")} to create one`)
        process.exit(1)
      }

      console.error(pc.red("✗ Error loading configuration:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private showConfigSummary(config: Config) {
    console.log(pc.green("✓") + " Configuration: " + pc.dim(config.path))
    console.log()

    console.log(pc.bold("Version"))
    console.log(`  ${pc.cyan(config.version)}`)
    console.log()

    const filesConfig = config.options.files

    if (filesConfig) {
      console.log(pc.bold("Files"))

      if (filesConfig.include && filesConfig.include.length > 0) {
        console.log(`  ${pc.dim("Include:")} ${filesConfig.include.map(p => pc.green(p)).join(", ")}`)
      }

      if (filesConfig.exclude && filesConfig.exclude.length > 0) {
        console.log(`  ${pc.dim("Exclude:")} ${filesConfig.exclude.map(p => pc.red(p)).join(", ")}`)
      }

      if (!filesConfig.include && !filesConfig.exclude) {
        console.log(`  ${pc.dim("Using defaults")}`)
      }

      console.log()
    }

    const linterConfig = config.options.linter
    console.log(pc.bold("Linter"))
    const linterEnabled = linterConfig?.enabled !== false
    console.log(`  ${pc.dim("Status:")} ${linterEnabled ? pc.green("enabled") : pc.red("disabled")}`)

    if (linterConfig?.rules) {
      const ruleCount = Object.keys(linterConfig.rules).length

      const enabledRules = Object.entries(linterConfig.rules).filter(([_, config]) =>
        (config as any).enabled !== false
      ).length

      console.log(`  ${pc.dim("Rules:")} ${enabledRules}/${ruleCount} enabled`)
    }

    if (linterConfig?.include && linterConfig.include.length > 0) {
      console.log(`  ${pc.dim("Include:")} ${linterConfig.include.map(p => pc.green(p)).join(", ")}`)
    }

    if (linterConfig?.exclude && linterConfig.exclude.length > 0) {
      console.log(`  ${pc.dim("Exclude:")} ${linterConfig.exclude.map(p => pc.red(p)).join(", ")}`)
    }

    console.log()

    const formatterConfig = config.options.formatter
    console.log(pc.bold("Formatter"))

    const formatterEnabled = formatterConfig?.enabled !== false
    console.log(`  ${pc.dim("Status:")} ${formatterEnabled ? pc.green("enabled") : pc.red("disabled")}`)

    if (formatterConfig?.indentWidth) {
      console.log(`  ${pc.dim("Indent width:")} ${pc.cyan(String(formatterConfig.indentWidth))}`)
    }

    if (formatterConfig?.maxLineLength) {
      console.log(`  ${pc.dim("Max line length:")} ${pc.cyan(String(formatterConfig.maxLineLength))}`)
    }

    if (formatterConfig?.rewriter) {
      const preCount = formatterConfig.rewriter.pre?.length || 0
      const postCount = formatterConfig.rewriter.post?.length || 0

      if (preCount > 0 || postCount > 0) {
        console.log(`  ${pc.dim("Rewriters:")} ${preCount} pre, ${postCount} post`)
      }
    }

    if (formatterConfig?.include && formatterConfig.include.length > 0) {
      console.log(`  ${pc.dim("Include:")} ${formatterConfig.include.map(p => pc.green(p)).join(", ")}`)
    }

    if (formatterConfig?.exclude && formatterConfig.exclude.length > 0) {
      console.log(`  ${pc.dim("Exclude:")} ${formatterConfig.exclude.map(p => pc.red(p)).join(", ")}`)
    }
    console.log()

    console.log(pc.dim("Tip: Use") + " " + pc.cyan("herb config show --raw") + " " + pc.dim("to see the full YAML file"))
  }

  private async validateConfig(args: string[]) {
    try {
      const projectPath = args.includes("--project")
        ? args[args.indexOf("--project") + 1]
        : process.cwd()

      const config = await Config.load(projectPath, { silent: true })

      if (!config) {
        console.error(pc.red("✗ No .herb.yml configuration file found"))
        console.error(`Run ${pc.cyan("herb config init")} to create one`)
        process.exit(1)
      }

      console.log(pc.green("✓") + " Configuration is valid: " + pc.dim(config.path))
    } catch (error) {
      console.error(pc.red("✗ Configuration validation failed:"))
      console.error()
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async initConfig(args: string[]) {
    try {
      const projectPath = args.includes("--project")
        ? args[args.indexOf("--project") + 1]
        : process.cwd()

      const force = args.includes("--force")
      const configPath = Config.configPathFromProjectPath(projectPath)

      let fileExists = false

      try {
        await fs.access(configPath)
        fileExists = true
      } catch {
        fileExists = false
      }

      if (fileExists && !force) {
        console.error(pc.yellow("⚠ Configuration file already exists: ") + pc.dim(configPath))
        console.error(`Use ${pc.cyan("--force")} to overwrite`)
        process.exit(1)
      }

      if (force && fileExists) {
        await fs.unlink(configPath)
      }

      const config = await Config.load(projectPath, {
        silent: true,
        createIfMissing: true
      })

      const relativePath = path.relative(process.cwd(), config.path) || config.path
      console.log(pc.green("✓") + " Created configuration at " + pc.cyan(relativePath) + " " + pc.dim(`(${config.path})`))

      const extensionAdded = addHerbExtensionRecommendation(projectPath)

      if (extensionAdded) {
        const extensionsRelativePath = getExtensionsJsonRelativePath()
        const extensionsFullPath = path.join(projectPath, extensionsRelativePath)
        console.log(pc.green("✓") + " VSCode extension recommended in " + pc.cyan(extensionsRelativePath) + " " + pc.dim(`(${extensionsFullPath})`))
      }

      console.log()
      console.log("Edit " + pc.cyan(".herb.yml") + " to customize Herb's behavior for your project.")
    } catch (error) {
      console.error(pc.red("✗ Error creating configuration:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async showPath(args: string[]) {
    try {
      const projectPath = args.includes("--project")
        ? args[args.indexOf("--project") + 1]
        : process.cwd()

      const config = await Config.load(projectPath, { silent: true })

      if (!config) {
        console.error(pc.yellow("⚠ No .herb.yml configuration file found"))
        console.error(`Run ${pc.cyan("herb config init")} to create one`)
        process.exit(1)
      }

      console.log(config.path)
    } catch (error) {
      console.error(pc.red("✗ Error finding configuration:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
}
