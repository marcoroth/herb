---
title: Using Herb with Zed
head:
  - - meta
    - property: og:image
      content: /herb-zed.png
---

# {{ $frontmatter.title }}

The Herb Language Server is integrated into Zed's official Ruby extension, providing seamless HTML+ERB support.

![Herb with Zed](/herb-zed.png)

## Installation

The Herb Language Server comes pre-installed with the official **Ruby extension for Zed**. Simply install the Ruby extension and you're ready to go!


## Configuration

No additional configuration needed - the Ruby extension handles everything automatically.

Anything the whole team should agree on belongs in a [`.herb.yml`](/configuration) file in your project root, which every Herb tool reads. The settings below are the ones that are yours alone.

### Personal settings

Zed keeps language server settings under `lsp.<server>.initialization_options`, so Herb's editor preferences go in your `settings.json`:

```json [settings.json]
{
  "lsp": {
    "herb": {
      "initialization_options": {
        "inlayHints": {
          "enabled": true,
          "minimumLines": 10,
          "maximumClasses": 2
        },
        "semanticTokens": {
          "enabled": true
        },
        "linter": {
          "enabled": true,
          "fixOnSave": true
        }
      }
    }
  }
}
```

These are the same options VS Code exposes as `languageServerHerb.*` settings, minus the `languageServerHerb` prefix. See the [language server documentation](/projects/language-server) for the full list.

### Semantic highlighting

Herb can colour HTML+ERB from the parsed template rather than from a Tree-sitter grammar, which keeps tags, attributes and ERB delimiters right where they nest inside each other. Zed requests semantic tokens only when you ask it to, so turn them on for HTML+ERB:

```json [settings.json]
{
  "languages": {
    "HTML+ERB": {
      "semantic_tokens": "combined"
    }
  }
}
```

`combined` layers the language server's tokens over Tree-sitter, which is what you want here, since Herb deliberately says nothing about the Ruby inside `<% %>` and leaves it to Tree-sitter and the Ruby language server. `full` would drop Tree-sitter entirely and leave that Ruby unstyled.

Colours come from `semantic_token_rules`, matched by token type and modifier. Herb emits `type` for tag names, `property` for attribute names, `string` for values, `macro` for the `<%` and `%>` delimiters with an `output` modifier on `<%=` tags, `parameter` for the names in a `locals:` declaration, and `function` with the `defaultLibrary` modifier for Action View helpers:

```json [settings.json]
{
  "global_lsp_settings": {
    "semantic_token_rules": [
      { "token_type": "function", "token_modifiers": ["defaultLibrary"], "foreground_color": "#61AFEF" },
      { "token_type": "macro", "token_modifiers": ["output"], "foreground_color": "#C678DD" },
      { "token_type": "macro", "foreground_color": "#BE5046" },
      { "token_type": "property", "foreground_color": "#D19A66" },
      { "token_type": "type", "foreground_color": "#E06C75" }
    ]
  }
}
```

Set `semanticTokens.enabled` to `false` in the initialization options above to turn the feature off on Herb's side instead.

### Inlay hints

Herb annotates the closing tag of longer blocks with what it closes. Zed turns inlay hints off by default, so you need to enable them for HTML+ERB as well as configuring them on the Herb side:

```json [settings.json]
{
  "languages": {
    "HTML+ERB": {
      "inlay_hints": {
        "enabled": true
      }
    }
  }
}
```

Herb emits its hints as parameter hints, so leave Zed's `show_parameter_hints` at its default of `true`.

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).

## Resources

- [Zed Ruby documentation](https://zed.dev/docs/languages/ruby)
- [Ruby extension source](https://github.com/zed-extensions/ruby)
- [Report Herb-specific issues](https://github.com/marcoroth/herb/issues)