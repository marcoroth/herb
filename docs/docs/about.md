<script setup>
  import { VPTeamMembers } from "vitepress/theme"

  const creator = {
    avatar: "https://www.github.com/marcoroth.png",
    name: "Marco Roth",
    title: "Creator and Project Lead",
    links: [
      { icon: "github", link: "https://github.com/marcoroth" },
      { icon: "twitter", link: "https://twitter.com/marcoroth_" },
      { icon: "mastodon", link: "https://ruby.social/@marcoroth" },
      { icon: "bluesky", link: "https://bsky.app/profile/marcoroth.dev" },
    ]
  }
</script>

# About Herb

The Herb Project was created and is led by Marco Roth.

## Maintainers

<VPTeamMembers size="small" :members="[creator]" />

## Contributors

Herb wouldn't be possible without all its contributors. Thank you to all the amazing people who have directly contributed to the project:

<GitHubContributors owner="marcoroth" repo="herb" :limit="30" />

## Prior Art & Inspiration

While Herb brings a fresh approach to HTML+ERB tooling, it builds upon and learns from several existing tools and approaches in the ecosystem:

- [**Tree-sitter**](https://tree-sitter.github.io/tree-sitter/)
- [**tree-sitter-embedded-template**](https://github.com/tree-sitter/tree-sitter-embedded-template)
- [**Prism Ruby Parser**](https://github.com/ruby/prism)
- [**Ruby LSP**](https://github.com/Shopify/ruby-lsp)
- [**better-html**](https://github.com/Shopify/better-html)
- [**erb_lint**](https://github.com/Shopify/erb_lint)
- [**erb-formatter**](https://github.com/nebulab/erb-formatter)
- [**erb-formatter-vscode**](https://github.com/nebulab/erb-formatter-vscode)
- [**erblint-github**](https://github.com/github/erblint-github)
- [**deface**](https://github.com/spree/deface)
- [**html_press**](https://github.com/stereobooster/html_press)
- [**htmlbeautifier**](https://github.com/threedaymonk/htmlbeautifier)
- [**vscode-erb-beautify**](https://github.com/aliariff/vscode-erb-beautify)
- [**vscode-erb-linter**](https://github.com/manuelpuyol/vscode-erb-linter)
- [**syntax_tree-erb**](https://github.com/davidwessman/syntax_tree-erb)

Herb differentiates itself by being HTML-aware from the ground up, providing a unified parsing approach that understands both HTML and ERB as first-class citizens, instead of treating one as embedded within the other.
