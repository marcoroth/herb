# rubocop-herb

`rubocop-herb` runs a project's configured RuboCop rules against Ruby embedded in `.erb` and `.herb` templates. Herb builds a position-preserving Ruby representation of the entire template so RuboCop can understand control flow and variable usage across ERB tags while reporting offenses at their original template locations.

Requires RuboCop 1.92 or newer. Add the gem to your bundle:

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

The plugin honors the project's RuboCop configuration, including custom cops, inherited configuration, target Ruby versions, file exclusions, and autocorrection. Cops that depend on physical Ruby file contents or layout, or that misread template control flow, are [excluded for template files by default](config/default.yml).

Template-local `rubocop:disable`, `rubocop:enable`, and `rubocop:todo` directives work inside ERB comments:

```erb
<%# rubocop:disable Layout/SpaceAroundOperators %>
<%= x=1 %>
<%# rubocop:enable Layout/SpaceAroundOperators %>
```

Offenses are only reported for Ruby inside ERB tags, and autocorrections that would touch markup are discarded, so `rubocop -a` and `rubocop -A` never rewrite HTML or ERB delimiters.

Every `.erb` and `.herb` file is inspected, including non-HTML templates. To skip some of them, exclude them in `.rubocop.yml`:

```yaml
AllCops:
  Exclude:
    - "**/*.yml.erb"
```
