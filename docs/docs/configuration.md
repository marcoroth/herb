# Configuration <Badge type="tip" text="^0.8.0" />

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

# Force linting on a file excluded by configuration
herb-lint --force app/views/excluded-file.html.erb

# Force formatting even if disabled in .herb.yml
herb-format --force --check app/views/
```

When using `--force` on an explicitly specified file that is excluded by configuration patterns, the CLI will show a warning but proceed with processing the file.

## Linter Configuration

Configure the linter behavior and rules:

```yaml [.herb.yml]
linter:
  enabled: true  # Enable/disable linter globally

  # # Exit with error code when diagnostics of this severity or higher are present
  # # Valid values: error (default), warning, info, hint
  # failLevel: error

  # Additional glob patterns to include (additive to defaults)
  include:
    - '**/*.xml.erb'
    - 'custom/**/*.html'

  # Glob patterns to exclude from linting
  exclude:
    - 'vendor/**/*'
    - 'node_modules/**/*'
    - 'app/views/admin/**/*'

  rules:
    # Disable a specific rule
    erb-no-extra-newline:
      enabled: false

    # Override rule severity
    html-tag-name-lowercase:
      severity: warning  # Options: error, warning, info, hint

    # Rule with file pattern restrictions
    html-img-require-alt:
      # Only apply this rule to files matching these patterns
      only:
        - 'app/views/**/*'
      # Don't apply this rule to these files (even if they match 'only')
      exclude:
        - 'app/views/admin/**/*'

    # Rule with additive include patterns
    erb-no-extra-newline:
      # Apply this rule to additional file patterns (ignored if 'only' is present)
      include:
        - 'app/components/**/*'
      # Exclude specific files from this rule
      exclude:
        - 'app/components/legacy/**/*'
```

### Default File Patterns

By default, Herb processes these file patterns:
- `**/*.herb`
- `**/*.html`
- `**/*.html.erb`
- `**/*.html.herb`
- `**/*.html+*.erb`
- `**/*.rhtml`
- `**/*.turbo_stream.erb`

And excludes these patterns by default:
- `coverage/**/*`
- `log/**/*`
- `node_modules/**/*`
- `storage/**/*`
- `tmp/**/*`
- `vendor/**/*`

Both `include` and `exclude` patterns are **additive**, they add to the defaults rather than replacing them.

### Linter Options

- **`enabled`**: `true` or `false` - Enable or disable the linter globally
- **`failLevel`** <Badge type="info" text="v0.8.7+" />: `error`, `warning`, `info`, or `hint` - Exit with error code when diagnostics of this severity or higher are present (default: `error`). Useful for CI/CD pipelines where you want stricter enforcement. Can also be set via `--fail-level` CLI flag.
- **`include`**: Array of glob patterns - Additional file patterns to lint (additive to defaults)
- **`exclude`**: Array of glob patterns - Additional patterns to exclude from linting (additive to defaults)

### Rule Configuration Options

Each rule can be configured with the following options:

- **`enabled`**: `true` or `false` - Enable or disable the rule
- **`severity`**: `error`, `warning`, `info`, or `hint` - Set the severity level
- **`include`**: Array of glob patterns - Restrict rule to files matching these patterns (can override parent excludes)
- **`only`**: Array of glob patterns - Restrict rule to ONLY these files (can override parent excludes, overrides `include`)
- **`exclude`**: Array of glob patterns - Exclude files from this rule (always applied)

#### Pattern Precedence

When configuring rule-level file patterns:

1. If **`only`** or **`include`** matches the path: **bypasses parent-level excludes** (`linter.exclude`, `files.exclude`, defaults)
2. If no `only`/`include` patterns or path doesn't match: respects all parent-level excludes
3. **`exclude`** is always applied regardless of `include` or `only`

::: tip Overriding Parent Excludes
Use `rule.include` or `rule.only` to run a specific rule on files that are normally excluded. For example, to lint files in `vendor/` with a specific rule even though `vendor/**/*` is excluded by default:

```yaml
linter:
  rules:
    html-tag-name-lowercase:
      include:
        - 'vendor/**/*'
```
:::

Example:

```yaml [.herb.yml]
linter:
  rules:
    # This rule only runs on component files, excluding legacy ones
    some-rule:
      include:
        - 'app/components/**/*'
      exclude:
        - 'app/components/legacy/**/*'

    # This rule only runs on views, with 'only' overriding any includes
    another-rule:
      include:
        - 'app/components/**/*'  # This is ignored because 'only' is present
      only:
        - 'app/views/**/*'
      exclude:
        - 'app/views/admin/**/*'
```

## Formatter Configuration

Configure the formatter behavior:

```yaml [.herb.yml]
formatter:
  enabled: false     # Disabled by default (experimental)
  indentWidth: 2     # Number of spaces for indentation
  maxLineLength: 80  # Maximum line length before wrapping

  # Additional glob patterns to include (additive to defaults)
  include:
    - '**/*.xml.erb'

  # Glob patterns to exclude from formatting
  exclude:
    - 'app/views/generated/**/*'
    - 'vendor/**/*'
```

### Formatter Options

- **`enabled`**: `true` or `false` - Enable or disable the formatter
- **`indentWidth`**: Number (default: `2`) - Spaces per indent level
- **`maxLineLength`**: Number (default: `80`) - Maximum line length
- **`include`**: Array of glob patterns - Additional patterns to format (additive to defaults)
- **`exclude`**: Array of glob patterns - Additional patterns to exclude from formatting (additive to defaults)

::: warning Experimental Feature
The formatter is currently experimental. Enable it in `.herb.yml` and test thoroughly before using in production.
:::

## Top-Level File Configuration

Global file configuration that applies to both linter and formatter:

```yaml [.herb.yml]
files:
  # Additional glob patterns to include (additive to defaults, applies to all tools)
  include:
    - '**/*.xml.erb'
    - '**/*.rss.erb'

  # Additional global exclude patterns (additive to defaults, applies to all tools)
  exclude:
    - 'public/**/*'
    - 'generated/**/*'
```

### Configuration Merging

Both `include` and `exclude` patterns are **additive** at all levels - your patterns are added to the defaults rather than replacing them.

File patterns are merged in the following order:

1. **Defaults**: Built-in include patterns (`**/*.html.erb`, etc.) and exclude patterns (`node_modules/**/*`, `vendor/**/*`, etc.)
2. **Top-level `files.include`/`files.exclude`**: Added to defaults
3. **Tool-level patterns** (e.g., `linter.include`, `linter.exclude`): Added to the combined list

Example:

```yaml [.herb.yml]
files:
  include:
    - '**/*.xml.erb'    # Applies to all tools
  exclude:
    - 'public/**/*'     # Added to default excludes for all tools

linter:
  include:
    - '**/*.custom.erb' # Only applies to linter
  exclude:
    - 'legacy/**/*'     # Added to excludes for linter only
```

Result for linter:
- Includes: All defaults + `**/*.xml.erb` + `**/*.custom.erb`
- Excludes: All defaults + `public/**/*` + `legacy/**/*`

::: tip Including Previously Excluded Files
If you want to include files from a default-excluded directory (e.g., `coverage/**`), add a more specific pattern to `include`. Include patterns are checked before exclude patterns when finding files.
:::

## Inspecting Configuration

Use the `bundle exec herb config` command to inspect the resolved configuration and see which files will be processed:

Show general configuration and files:

```bash
bundle exec herb config
```

Show configuration for a specific tool:
```bash
bundle exec herb config --tool linter
bundle exec herb config --tool formatter
```

If you don't specify a path it assume the current directory
```bash
bundle exec herb config .
```

You can also pass in a path to another directory:
```bash
bundle exec herb config ../other-project/
```

### General Configuration

Running `bundle exec herb config .` displays:

- **Project root**: The detected project root directory
- **Config file**: Path to the `.herb.yml` file (or "(using defaults)" if none)
- **Include patterns**: All patterns used to find files
- **Exclude patterns**: All patterns used to exclude files
- **Files**: List of included and excluded files with their status

Example output:

```
Herb Configuration

Project root: /path/to/project
Config file:  /path/to/project/.herb.yml

Include patterns:
  + **/*.herb
  + **/*.html.erb
  + **/*.html
  + **/*.turbo_stream.erb

Exclude patterns:
  - coverage/**/*
  - node_modules/**/*
  - vendor/**/*

Files (42 included, 5 excluded):

  Included:
    ✓ app/views/home/index.html.erb
    ✓ app/views/layouts/application.html.erb

  Excluded:
    ✗ vendor/bundle/gem/template.html.erb (vendor/**/*)]

Tip: Use --tool linter or --tool formatter to see tool-specific configuration
```

### Tool-Specific Configuration

Use the `--tool` flag to see configuration for a specific tool:

```bash
bundle exec herb config . --tool linter
```

This shows:
- Combined patterns from `files.*` and `linter.*` (or `formatter.*`)
- Files that would be processed by that specific tool
- A warning if the tool is disabled in configuration

Example output:

```
Herb Configuration for Linter

Project root: /path/to/project
Config file:  /path/to/project/.herb.yml

Include patterns (files + linter):
  + **/*.html.erb
  + **/*.custom.erb

Exclude patterns (files + linter):
  - node_modules/**/*
  - vendor/**/*
  - legacy/**/*

Files for linter (40 included, 7 excluded):

  Included:
    ✓ app/views/home/index.html.erb

  Excluded:
    ✗ legacy/old.html.erb (legacy/**/*)
```

::: tip Debugging Configuration
The `bundle exec herb config` command is useful for:
- Verifying your `.herb.yml` is being read correctly
- Understanding why certain files are included or excluded
- Debugging tool-specific patterns
- Confirming the project root detection
:::
