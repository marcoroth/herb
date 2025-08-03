# Using Herb with Helix

Integrate the Herb Language Server with Helix for HTML+ERB development.

![Herb with Helix](/herb-helix.png)

## Installation

First, install the Herb Language Server globally:

:::code-group

```bash [npm]
npm install -g @herb-tools/language-server
```

```bash [yarn]
yarn global add @herb-tools/language-server
```

```bash [pnpm]
pnpm add -g @herb-tools/language-server
```

```bash [bun]
bun add -g @herb-tools/language-server
```
:::

## Configuration

Configure Helix to use the Herb Language Server by adding the following to your `~/.config/helix/languages.toml`:

```toml [~/.config/helix/languages.toml]
[language-server.herb]
command = "herb-language-server"
args = ["--stdio"]

[[language]]
name = "erb"
language-servers = ["herb"]
file-types = ["erb", "html.erb"]
roots = ["Gemfile", "package.json"]
```

## Troubleshooting

### Debugging

To debug language server issues, you can:

1. Check Helix logs: `hx -vvv` to run Helix with verbose logging
2. View the log file: usually located at `~/.cache/helix/helix.log`
3. Look for language server errors in the output

## Additional Resources

- [Helix Documentation](https://docs.helix-editor.com/)
- [Helix Language Configuration](https://docs.helix-editor.com/languages.html)
- [Herb Language Server Documentation](/projects/language-server)
