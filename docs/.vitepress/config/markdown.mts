import { groupIconMdPlugin } from "vitepress-plugin-group-icons"
import { herbLinterTransformer } from "../transformers/herb-linter-transformer.mjs"

export function createMarkdownConfig() {
  return {
    config(md) {
      md.use(groupIconMdPlugin)
    },
    codeTransformers: [
      herbLinterTransformer,
    ],
    // Explicitly load these languages for types highlighting
    languages: ["js", "ts", "bash", "shell", "ruby", "html", "erb", "java", "rust"],
    image: {
      lazyLoading: true
    },
  }
}
