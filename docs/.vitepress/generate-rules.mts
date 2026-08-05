import fs from "fs"
import path from "path"

// Function to generate wrapper files for linter rules
export function generateRuleWrappers() {
  const sourceRulesDir = path.resolve(__dirname, "../../javascript/packages/linter/docs/rules")
  const targetRulesDir = path.resolve(__dirname, "../docs/linter/rules")

  if (!fs.existsSync(sourceRulesDir)) {
    return []
  }

  if (!fs.existsSync(targetRulesDir)) {
    fs.mkdirSync(targetRulesDir, { recursive: true })
  }

  const files = fs.readdirSync(sourceRulesDir)
  const ruleFiles = files.filter(file => file.endsWith(".md") && file !== "README.md")

  ruleFiles.forEach(file => {
    const wrapperContent = `<!-- @include: ../../../../javascript/packages/linter/docs/rules/${file} -->`

    const targetPath = path.join(targetRulesDir, file)
    fs.writeFileSync(targetPath, wrapperContent)
  })

  const indexContent = `<!-- @include: ../../../../javascript/packages/linter/docs/rules/README.md -->`

  fs.writeFileSync(path.join(targetRulesDir, "index.md"), indexContent)

  return ruleFiles.map(file => {
    const ruleName = file.replace(".md", "")

    return {
      text: ruleName,
      link: `/linter/rules/${ruleName}`
    }
  }).sort((a, b) => a.text.localeCompare(b.text))
}
