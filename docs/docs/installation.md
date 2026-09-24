# Installation

Herb reads the templates you already have. Installing it changes nothing about how your app renders until you switch the engine on, so you can start with the tools and decide about rendering later.

## Check your templates first

Run this in the root of your project. It parses every template and reports which ones Herb reads cleanly and which have errors, without adding anything to your `Gemfile`.

::: code-group
```shell [gem exec]
gem exec herb analyze
```
:::

A template with a parse error usually has an unclosed or mismatched tag that the browser has been quietly repairing. [Templates](/language/templates#what-herb-rejects) lists what Herb rejects and why.

## In a Rails app

With the Rails 8.2 framework defaults, Rails already renders HTML templates with `Herb::Engine`. [ReActionView](https://reactionview.dev) makes those templates reactive and adds the error overlays and the dev tools, and on Rails 8.1 and earlier it is what puts `Herb::Engine` in front of your views. Its [Setup guide](https://reactionview.dev/installation) installs the gem and the JavaScript package together.

## The gem

The `herb` gem ships the parser, the Ruby bindings, `Herb::Engine` and the `herb` command.

::: code-group
```shell [Bundler]
bundle add herb
```

```shell [RubyGems]
gem install herb
```
:::

Once it is in your bundle, `bundle exec herb analyze` does what `gem exec` did above, and `bundle exec herb --help` lists the other commands.

## The linter and the formatter

The linter and the formatter are npm packages. You can run them without installing anything into the project.

::: code-group
```shell [Linter]
npx @herb-tools/linter
```

```shell [Formatter]
npx @herb-tools/formatter
```
:::

With the gem installed, `bundle exec herb lint` and `bundle exec herb format` run the same packages. The [Linter](/projects/linter) and [Formatter](/projects/formatter) pages cover configuration, and [Configuration](/configuration) covers the `.herb.yml` file both of them read.

## Your editor

The Herb Language Server shows parse errors and linter findings as you type, and formats on save. Zed includes it by default. Every other editor needs its extension or a small configuration, which the [editor pages](/integrations/editors) walk through one by one.

## Continuous integration

The linter runs in CI the same way it runs locally. [CI Integrations](/integrations/ci) has ready-made setups for GitHub Actions, GitLab CI and Bitbucket Pipelines.

## Installing from a Git branch

To try a branch before it is released, add both `prism` and `herb` to your `Gemfile`.

::: code-group
```ruby [Gemfile]
gem "prism", github: "ruby/prism", tag: "v1.9.0"
gem "herb", github: "fork/herb", branch: "my-branch"
```
:::

Herb's C extension compiles against Prism's C source, which is vendored from the `prism` gem during installation.
