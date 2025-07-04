import {
  groupIconVitePlugin,
  localIconLoader,
} from "vitepress-plugin-group-icons"

export function createViteConfig() {
  // https://vp.yuy1n.io/features.html
  // https://github.com/vscode-icons/vscode-icons/wiki/ListOfFiles
  const groupIconPlugin = groupIconVitePlugin({
    customIcon: {
      ruby: "vscode-icons:file-type-ruby",
      ".rb": "vscode-icons:file-type-ruby",
      ".gemspec": "vscode-icons:file-type-ruby",
      gemfile: "vscode-icons:file-type-bundler",
      browser: "vscode-icons:file-type-js",
      "Node.js": "vscode-icons:file-type-js",
      ".js": "vscode-icons:file-type-js",
      javascript: "vscode-icons:file-type-js",
      shell: "vscode-icons:file-type-shell",
      ".erb": localIconLoader(import.meta.url, "../assets/herb.svg"),
      ".html.erb": localIconLoader(import.meta.url, "../assets/herb.svg"),
      ".herb": localIconLoader(import.meta.url, "../assets/herb.svg"),
    },
  })

  return {
    plugins: [groupIconPlugin],
  }
}
