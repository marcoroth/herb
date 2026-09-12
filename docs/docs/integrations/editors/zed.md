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

### Closing ERB blocks

When you finish typing the `%>` of a block opener, Herb writes the matching `<% end %>` below it and leaves your cursor on the indented blank line in between:

```erb
<% if user.admin? %>
  <!-- cursor lands here -->
<% end %>
```

Zed runs this through `use_on_type_format`, which is already on by default. To turn it off for HTML+ERB:

```json [settings.json]
{
  "languages": {
    "HTML+ERB": {
      "use_on_type_format": false
    }
  }
}
```

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).

## Resources

- [Zed Ruby documentation](https://zed.dev/docs/languages/ruby)
- [Ruby extension source](https://github.com/zed-extensions/ruby)
- [Report Herb-specific issues](https://github.com/marcoroth/herb/issues)