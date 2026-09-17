# rubocop-herb

`rubocop-herb` runs a project's configured RuboCop rules against Ruby embedded
in ERB templates. Herb parses the template and RuboCop reports and corrects
offenses at their original template locations.

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

The plugin honors the project's RuboCop configuration, including custom cops,
inherited configuration, target Ruby versions, and file exclusions. Cops that
require a complete Ruby file or surrounding Ruby structure are excluded for ERB
templates by default.

The RuboCop extractor design builds on prior art from
[`rubocop-erb`](https://github.com/r7kamura/rubocop-erb).
