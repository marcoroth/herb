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
- `**/*.html`
- `**/*.rhtml`
- `**/*.html.erb`
- `**/*.html+*.erb`
- `**/*.turbo_stream.erb`

The `include` patterns are **additive** - they add to the defaults rather than replacing them.

### Rule Configuration Options

Each rule can be configured with the following options:

- **`enabled`**: `true` or `false` - Enable or disable the rule
- **`severity`**: `error`, `warning`, `info`, or `hint` - Set the severity level
- **`include`**: Array of glob patterns - Apply rule to additional files (additive, ignored when `only` is present)
- **`only`**: Array of glob patterns - Restrict rule to ONLY these files (overrides all `include` patterns)
- **`exclude`**: Array of glob patterns - Exclude files from this rule (always applied)

#### Pattern Precedence

When configuring rule-level file patterns, the precedence is:

1. If **`only`** is specified: Rule applies ONLY to files matching `only` patterns (all `include` patterns are ignored)
2. If **`only`** is NOT specified but **`include`** is: Rule applies ONLY to files matching `include` patterns
3. **`exclude`** is always applied regardless of `include` or `only`

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
- **`exclude`**: Array of glob patterns - Patterns to exclude from formatting

::: warning Experimental Feature
The formatter is currently experimental. Enable it in `.herb.yml` and test thoroughly before using in production.
:::

## Top-Level File Configuration

Global file configuration that applies to both linter and formatter:

```yaml [.herb.yml]
files:
  # Additional glob patterns to include (additive to defaults)
  include:
    - '**/*.xml.erb'
    - '**/*.rss.erb'

  # Global exclude patterns (applies to all tools)
  exclude:
    - 'public/**/*'
    - 'tmp/**/*'
    - 'vendor/**/*'
```

### Configuration Merging

File patterns are merged in the following order:

1. **Defaults**: Built-in patterns (`**/*.html.erb`, etc.)
2. **Top-level `files.include`**: Added to defaults
3. **Tool-level `include`** (e.g., `linter.include`): Added to the combined list
4. **Exclusions**: Tool-level `exclude` takes precedence over top-level `files.exclude`

Example:

```yaml [.herb.yml]
files:
  include:
    - '**/*.xml.erb'    # Applies to both linter and formatter

linter:
  include:
    - '**/*.custom.erb' # Only applies to linter
  exclude:
    - 'vendor/**/*'     # Linter-specific exclusion
```

Result for linter:
- Includes: All defaults + `**/*.xml.erb` + `**/*.custom.erb`
- Excludes: `vendor/**/*`
