# frozen_string_literal: true

begin
  require_relative "lib/herb/highlighter/version"
rescue LoadError
  puts "WARNING: Could not load Herb::Highlighter::VERSION"
end

Gem::Specification.new do |spec|
  spec.name = "herb-highlighter"
  spec.version = defined?(Herb::Highlighter::VERSION) ? Herb::Highlighter::VERSION : "0.0.0"
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "Syntax highlighter and diagnostic renderer for HTML+ERB templates"
  spec.description = "Renders HTML+ERB with terminal syntax highlighting, diagnostic snippets, and diffs."
  spec.homepage = "https://herb-tools.dev"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.2.0"
  spec.require_paths = ["lib"]

  spec.files = Dir[
    "herb-highlighter.gemspec",
    "LICENSE.txt",
    "README.md",
    "lib/**/*.rb",
    "sig/**/*.rbs",
    "exe/herb-highlight",
    "exe/*/herb-highlight",
    "ext/herb_highlighter/extconf.rb",
    "ext/herb_highlighter/herb_highlighter.c",
    "ext/herb_highlighter/include/**/*.h",
    "rust/Cargo.toml",
    "rust/Cargo.lock",
    "rust/build.rs",
    "rust/cbindgen.toml",
    "rust/src/**/*.rs"
  ]

  spec.bindir = "exe"
  spec.executables = ["herb-highlight"]
  spec.extensions = ["ext/herb_highlighter/extconf.rb"]

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.metadata["homepage_uri"] = "https://herb-tools.dev"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/herb/releases"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/herb"
  spec.metadata["bug_tracker_uri"] = "https://github.com/marcoroth/herb/issues"
  spec.metadata["documentation_uri"] = "https://herb-tools.dev"
end
