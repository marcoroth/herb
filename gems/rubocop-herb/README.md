# rubocop-herb

`rubocop-herb` runs a project's configured RuboCop rules against Ruby embedded in HTML+ERB (`.html.erb`) templates. Herb builds a position-preserving Ruby representation of the entire template so RuboCop can understand control flow and variable usage across ERB tags while reporting offenses at their original template locations.

Add the gem to your bundle:

```sh
bundle add rubocop-herb
```

Then enable the plugin in `.rubocop.yml`:

```yaml
plugins:
  - rubocop-herb
```

Then use RuboCop normally:

```sh
bundle exec rubocop app/views
bundle exec rubocop -a app/views
bundle exec rubocop -A app/views
```

The plugin honors the project's RuboCop configuration, including custom cops, inherited configuration, target Ruby versions, and file exclusions. Autocorrections are applied only when the complete edit falls within one original Ruby region, so corrections cannot modify HTML or ERB delimiters. Cops that depend on physical Ruby file contents or layout are [excluded for HTML+ERB templates by default](config/default.yml).
