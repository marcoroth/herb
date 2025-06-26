const path = require("path")
const { AutoLanguageClient } = require("atom-languageclient")

class HerbLanguageClient extends AutoLanguageClient {
  getGrammarScopes() {
    return ["text.html.erb", "text.html.basic"]
  }

  getLanguageName() {
    return "Herb"
  }

  getServerName() {
    return "Herb Language Server"
  }

  startServerProcess(projectPath) {
    const pkgPath = require.resolve("@herb-tools/language-server/package.json")
    const serverPath = path.join(
      path.dirname(pkgPath),
      "bin",
      "herb-language-server",
    )
    return super.spawnChildNode([serverPath, "--stdio"], { cwd: projectPath })
  }
}

module.exports = new HerbLanguageClient()
