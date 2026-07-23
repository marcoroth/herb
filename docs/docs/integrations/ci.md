# Using Herb in CI

Run the Herb [Linter](/projects/linter), [Formatter](/projects/formatter), and parser [analyzer](/bindings/ruby/reference) as part of your CI pipeline to keep HTML+ERB templates consistent and catch regressions on every push.

## Available Integrations

- **[GitHub Actions](/integrations/ci/github-actions)** - Inline PR annotations are enabled automatically
- **[GitLab CI](/integrations/ci/gitlab)** - Runs in any Node or Ruby image; optional Code Quality report
- **[Bitbucket Pipelines](/integrations/ci/bitbucket)** - Parallel lint, format, and analyze steps
- **[Reviewdog](/integrations/ci/reviewdog)** - Post linter findings as inline review comments

See the [Linter](/projects/linter) and [Formatter](/projects/formatter) docs for the full list of CLI flags available in each snippet.
