import { rules } from "../src/rules.js"

async function main() {
  const javascriptRuleNames = rules.map((RuleClass) => new RuleClass().name).sort()

  let nativeRuleNames: string[] = []
  let nativeAvailable = false

  try {
    const { Herb } = await import("@herb-tools/node-wasm")
    await Herb.load()

    if (Herb.supportsLint) {
      nativeRuleNames = Herb.lintRuleNames().sort()
      nativeAvailable = true
    }
  } catch {
    // WASM backend not available
  }

  const javascriptSet = new Set(javascriptRuleNames)
  const nativeSet = new Set(nativeRuleNames)

  const implementedInBoth = javascriptRuleNames.filter((name) => nativeSet.has(name))
  const javascriptOnly = javascriptRuleNames.filter((name) => !nativeSet.has(name))
  const nativeOnly = nativeRuleNames.filter((name) => !javascriptSet.has(name))

  const totalJavaScript = javascriptRuleNames.length
  const totalNative = nativeRuleNames.length
  const totalBoth = implementedInBoth.length
  const percentage = totalJavaScript > 0 ? ((totalBoth / totalJavaScript) * 100).toFixed(1) : "0.0"

  const noColor = process.env.NO_COLOR !== undefined

  const bold = (text: string) => noColor ? text : `\x1b[1m${text}\x1b[0m`
  const green = (text: string) => noColor ? text : `\x1b[32m${text}\x1b[0m`
  const red = (text: string) => noColor ? text : `\x1b[91m${text}\x1b[0m`
  const dim = (text: string) => noColor ? text : `\x1b[90m${text}\x1b[0m`
  const cyan = (text: string) => noColor ? text : `\x1b[36m${text}\x1b[0m`

  console.log()
  console.log(bold("Rust Linter Rule Implementation Progress"))
  console.log()

  if (!nativeAvailable) {
    console.log(red("Native backend not available. Cannot determine Rust rule list."))
    console.log(dim(`JavaScript linter has ${totalJavaScript} rules.`))
    console.log()
    return
  }

  console.log(bold("Summary:"))
  console.log(`  ${cyan(String(totalBoth))} of ${cyan(String(totalJavaScript))} rules implemented in Rust ${dim(`(${percentage}%)`)}`)
  console.log(`  ${dim(String(totalJavaScript))} JavaScript rules total`)
  console.log(`  ${dim(String(totalNative))} Rust rules total`)
  console.log()

  const barWidth = 40
  const filledWidth = Math.round((totalBoth / totalJavaScript) * barWidth)
  const emptyWidth = barWidth - filledWidth
  const progressBar = green("\u2588".repeat(filledWidth)) + dim("\u2591".repeat(emptyWidth))
  console.log(`  ${progressBar} ${percentage}%`)
  console.log()

  if (implementedInBoth.length > 0) {
    console.log(bold(`Implemented in both (${implementedInBoth.length}):`))
    for (const name of implementedInBoth) {
      console.log(`  ${green("\u2713")} ${name}`)
    }
    console.log()
  }

  if (nativeOnly.length > 0) {
    console.log(bold(`Rust only (${nativeOnly.length}):`))
    for (const name of nativeOnly) {
      console.log(`  ${cyan("\u2713")} ${name}`)
    }
    console.log()
  }

  if (javascriptOnly.length > 0) {
    console.log(bold(`Not yet in Rust (${javascriptOnly.length}):`))
    for (const name of javascriptOnly) {
      console.log(`  ${red("\u2717")} ${name}`)
    }
    console.log()
  }
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
