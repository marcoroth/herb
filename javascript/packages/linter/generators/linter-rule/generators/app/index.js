import Generator from "yeoman-generator"

import { execSync } from "child_process"

import chalk from "chalk"
import fs from "fs/promises"
import path from "path"

export default class extends Generator {
  async prompting() {
    this.log(chalk.green("Welcome to the Herb Linter Rule generator!"))

    let hasGH = false

    try {
      execSync("which gh", { stdio: "ignore" })
      hasGH = true
    } catch (error) {
      this.log(chalk.yellow("GitHub CLI (gh) not found. Manual input will be required."))
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
            "gh issue list --repo marcoroth/herb --label linter --state open --limit 100 --json number,title",
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

          // Get issue details
          const issueBody = execSync(
            `gh issue view ${issueChoice.issue} --repo marcoroth/herb --json body,title`,
            { encoding: "utf8" }
          )

          const issueDetails = JSON.parse(issueBody)

          // Extract rule name from issue body
          // Try different formats: ### Rule: `rule-name` or Rule name: rule-name
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
        } catch (error) {
          this.log(chalk.yellow("Failed to fetch GitHub issues. Proceeding with manual input."))
        }
      }
    }

    // If we didn"t get data from issue, ask manually
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
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
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

    // Create docs file
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
    // Update index.ts after all files are written to avoid conflicts
    const indexPath = path.join(this.destinationRoot(), "src/rules/index.ts")
    const newExport = `export * from "./${this.ruleName}.js"`

    try {
      await fs.appendFile(indexPath, newExport + "\n")
    } catch (error) {
      this.log(chalk.yellow(`Warning: Could not update index.ts automatically. Please add: ${newExport}`))
    }

    // Update README
    const readmePath = path.join(this.destinationRoot(), "docs/rules/README.md")
    const newRule = `- [${this.ruleName}](./${this.ruleName}.md) - ${this.description}`

    try {
      let readmeContent = await fs.readFile(readmePath, "utf8")

      if (!readmeContent.includes(newRule)) {
        const lines = readmeContent.split("\n")
        let insertIndex = -1

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("## Available Rules")) {
            // Find the last rule line
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
    } catch (error) {
      this.log(chalk.yellow(`Warning: Could not update README.md automatically. Please add: ${newRule}`))
    }
  }

  end() {
    this.log(chalk.green(`\nRule "${this.ruleName}" has been created!`))
    this.log("\nNext steps:")
    this.log(`1. Implement the rule logic in src/rules/${this.ruleName}.ts`)
    this.log(`2. Add test cases in test/rules/${this.ruleName}.test.ts`)
    this.log(`3. Update documentation in docs/rules/${this.ruleName}.md`)
  }
}
