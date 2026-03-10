import Generator from "yeoman-generator"
import { execSync } from "child_process"
import { colorize } from "@herb-tools/highlighter"
import fs from "fs/promises"
import path from "path"

export default class extends Generator {
  async prompting() {
    this.log(colorize("Welcome to the Herb Linter Rule generator!", "green"))

    let hasGH = false

    try {
      execSync("which gh", { stdio: "ignore" })
      hasGH = true
    } catch {
      this.log(colorize("GitHub CLI (gh) not found. Manual input will be required.", "yellow"))
    }

    let issueData = {}

    if (hasGH) {
      const useIssue = await this.prompt({
        type: "confirm",
        name: "useIssue",
        message: "Would you like to create a rule from a GitHub issue?",
        default: true
      })

      if (useIssue.useIssue) {
        try {
          const issues = execSync(
            "gh issue list --repo marcoroth/herb --label linter-rule --state open --limit 100 --json number,title",
            { encoding: "utf8" }
          )

          const issueList = JSON.parse(issues)

          const issueChoice = await this.prompt({
            type: "list",
            name: "issue",
            message: "Select an issue:",
            choices: issueList.map(issue => ({
              name: `#${issue.number}: ${issue.title}`,
              value: issue.number
            }))
          })

          const issueBody = execSync(
            `gh issue view ${issueChoice.issue} --repo marcoroth/herb --json body,title`,
            { encoding: "utf8" }
          )

          const issueDetails = JSON.parse(issueBody)

          let ruleNameMatch = issueDetails.body.match(/###\s*Rule:\s*`([^`]+)`/)

          if (!ruleNameMatch) {
            ruleNameMatch = issueDetails.body.match(/Rule name\s*:\s*`?\[?([^]`\n]*)\]?`?/)
          }

          if (ruleNameMatch) {
            issueData.ruleName = ruleNameMatch[1]
            issueData.description = issueDetails.title.replace(/^Linter Rule:\s*/, "")
            issueData.issueNumber = issueChoice.issue
            issueData.issueBody = issueDetails.body
          }
        } catch {
          this.log(colorize("Failed to fetch GitHub issues. Proceeding with manual input.", "yellow"))
        }
      }
    }

    if (!issueData.ruleName) {
      const answers = await this.prompt([
        {
          type: "input",
          name: "ruleName",
          message: "What is the rule name? (e.g., html-img-require-alt)",
          validate: input => /^[a-z-]+$/.test(input) || "Rule name should be lowercase with hyphens"
        },
        {
          type: "input",
          name: "description",
          message: "Brief description of the rule:",
          default: "TODO: Add description"
        }
      ])

      issueData = { ...answers }
    }

    this.ruleName = issueData.ruleName
    this.description = issueData.description
    this.issueNumber = issueData.issueNumber
    this.issueBody = issueData.issueBody || ""

    this.className = this.ruleName
      .split("-")
      .map(part => {
        if (part.toLowerCase() === "html") return "HTML"
        if (part.toLowerCase() === "erb") return "ERB"

        return part.charAt(0).toUpperCase() + part.slice(1)
      })
      .join("")

    this.ruleClassName = this.className + "Rule"
    this.visitorClassName = this.className + "Visitor"
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath("rule.ts.ejs"),
      this.destinationPath(`src/rules/${this.ruleName}.ts`),
      {
        ruleClassName: this.ruleClassName,
        visitorClassName: this.visitorClassName,
        ruleName: this.ruleName
      }
    )

    this.fs.copyTpl(
      this.templatePath("test.ts.ejs"),
      this.destinationPath(`test/rules/${this.ruleName}.test.ts`),
      {
        ruleClassName: this.ruleClassName,
        visitorClassName: this.visitorClassName,
        ruleName: this.ruleName
      }
    )

    this.fs.copyTpl(
      this.templatePath("docs.md.ejs"),
      this.destinationPath(`docs/rules/${this.ruleName}.md`),
      {
        ruleName: this.ruleName,
        description: this.description,
        issueBody: this.issueBody,
        title: this.issueNumber ? `Linter Rule: ${this.description}` : this.description
      }
    )
  }

  async install() {
    const indexPath = path.join(this.destinationRoot(), "src/rules/index.ts")
    const newExport = `export * from "./${this.ruleName}.js"`

    try {
      await fs.appendFile(indexPath, newExport + "\n")
    } catch {
      this.log(colorize(`Warning: Could not update index.ts automatically. Please add: ${newExport}`, "yellow"))
    }

    const defaultRulesPath = path.join(this.destinationRoot(), "src/default-rules.ts")
    const newImport = `import { ${this.ruleClassName} } from "./rules/${this.ruleName}.js"`

    try {
      let defaultRulesContent = await fs.readFile(defaultRulesPath, "utf8")

      const lines = defaultRulesContent.split("\n")
      const lastImportIndex = lines.findLastIndex(line => line.startsWith("import"))
      lines.splice(lastImportIndex + 1, 0, newImport)

      const arrayEndIndex = lines.findLastIndex(line => line.includes("]"))
      lines.splice(arrayEndIndex, 0, `  ${this.ruleClassName},`)

      await fs.writeFile(defaultRulesPath, lines.join("\n"))
    } catch {
      this.log(colorize(`Warning: Could not update default-rules.ts automatically. Please add import and rule class manually.`, "yellow"))
    }

    const readmePath = path.join(this.destinationRoot(), "docs/rules/README.md")
    const newRule = `- [\`${this.ruleName}\`](./${this.ruleName}.md) - ${this.description}`

    try {
      let readmeContent = await fs.readFile(readmePath, "utf8")

      if (!readmeContent.includes(newRule)) {
        const lines = readmeContent.split("\n")
        let insertIndex = -1

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("## Available Rules")) {
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim().startsWith("-")) {
                insertIndex = j
              } else if (lines[j].trim() === "" && insertIndex !== -1) {
                break
              }
            }

            break
          }
        }

        if (insertIndex !== -1) {
          lines.splice(insertIndex + 1, 0, newRule)
          await fs.writeFile(readmePath, lines.join("\n"))
        }
      }
    } catch {
      this.log(colorize(`Warning: Could not update README.md automatically. Please add: ${newRule}`, "yellow"))
    }
  }

  end() {
    this.log(colorize(`\nRule "${this.ruleName}" has been created!`, "green"))
    this.log("\nNext steps:")
    this.log(`1. Implement the rule logic in src/rules/${this.ruleName}.ts`)
    this.log(`2. Add test cases in test/rules/${this.ruleName}.test.ts`)
    this.log(`3. Update documentation in docs/rules/${this.ruleName}.md`)
  }
}
