# Configuration

Herb uses a `.herb.yml` configuration file to customize how the tools behave in your project. This configuration is shared across all Herb tools including the linter, formatter, and language server.

## Configuration File Location

The configuration file should be placed in your project root as `.herb.yml`:

```
your-project/
├── .herb.yml    # Herb configuration
├── Gemfile
├── app/
└── ...
```

## Configuration Priority

Configuration settings are applied in the following order (highest to lowest priority):

1. **Project configuration** (`.herb.yml` file)
2. **Editor settings** (VS Code workspace/user settings)
3. **Default settings**

## Basic Configuration

### Default Behavior (No Config File)

If no `.herb.yml` file exists in your project:

- **Language Server**: Uses built-in defaults and works out-of-the-box
- **Linter**: Enabled with all rules (automatic exclusion of `parser-no-errors` in language server only)
- **Formatter**: Disabled by default (experimental feature)
- **Editor settings**: VS Code user/workspace settings are respected

::: tip Recommended for Projects
If you're using Herb in a project with multiple developers, it's highly recommended to create a `.herb.yml` configuration file and commit it to your repository. This ensures all team members use consistent linting rules and formatting settings, preventing configuration drift and maintaining code quality standards across the project.
:::

### Creating a Configuration File

To create a `.herb.yml` configuration file in your project, run either CLI tool with the `--init` flag:

```bash
# Create config using the linter
herb-lint --init

# Or create config using the formatter
herb-format --init
```

This will generate a configuration file with sensible defaults:

<<< @/../../javascript/packages/config/src/config-template.yml{yaml}


## Command Line Overrides

The CLIs support a `--force` flag to override project configuration:

```bash
# Force linting even if disabled in .herb.yml
herb-lint --force app/views/

# Force formatting even if disabled in .herb.yml
herb-format --force --check app/views/
```

## Linter Configuration

Configure the linter behavior and rules:

```yaml [.herb.yml]
linter:
  enabled: true  # Enable/disable linter globally
  rules:
    erb-no-extra-newline:
      enabled: false # Disable a specific rule

    # Override rule severity
    html-tag-name-lowercase:
      severity: warning  # Options: error, warning, info, hint

    # File patterns to include for linting
    patterns:
      - app/views/**/*.html.erb

    # File patterns to exclude from linting
    exclude:
      - vendor/**/*
      - node_modules/**/*

    # File patterns and extensions
    extensions:
      - .xml.erb
      - .rhtml
```

### Rule Configuration Options

Each rule can be configured with the following options:

- **`enabled`**: `true` or `false` - Enable or disable the rule
- **`severity`**: `error`, `warning`, `info`, or `hint` - Set the severity level

## Formatter Configuration

Configure the formatter behavior:

```yaml [.herb.yml]
formatter:
  enabled: false     # Disabled by default (experimental)
  indentWidth: 2     # Number of spaces for indentation
  maxLineLength: 80  # Maximum line length before wrapping

  # File patterns to exclude from formatting
  exclude:
    - app/views/generated/**/*

  # File patterns and extensions
  patterns:
    - app/views/**/*.html.erb
```

### Formatter Options

- **`enabled`**: `true` or `false` - Enable or disable the formatter
- **`indentWidth`**: Number (default: `2`) - Spaces per indent level
- **`maxLineLength`**: Number (default: `80`) - Maximum line length

::: warning Experimental Feature
The formatter is currently experimental. Enable it in `.herb.yml` and test thoroughly before using in production.
:::

## File Configuration

Global file configuration that applies to both linter and formatter:

```yaml [.herb.yml]
files:
  # Additional file extensions to process
  extensions:
    - .xml.erb
    - .rss.erb

  # Global exclude patterns
  exclude:
    - public/**/*
    - tmp/**/*
    - vendor/**/*
```

::: warning Tool-specific Configurations
The configurations under `files:` have no effect if you also define `extensions`, `exclude`, or `patterns` under `linter:` or `formatter:` too.
:::
