# frozen_string_literal: true

begin
  require_relative "lib/herb/linter/version"
rescue LoadError
  puts "WARNING: Could not load Herb::Linter::VERSION"
end

Gem::Specification.new do |spec|
  spec.name = "herb-linter"
  spec.version = defined?(Herb::Linter::VERSION) ? Herb::Linter::VERSION : "0.0.0"
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "Linter for HTML+ERB templates"
  spec.description = "A fast, extensible linter for HTML+ERB templates. Built on the Herb parser with lint rules implemented in Rust."
  spec.homepage = "https://herb-tools.dev"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.2.0"
  spec.require_paths = ["lib"]

  spec.files = Dir[
    "herb-linter.gemspec",
    "LICENSE.txt",
    "README.md",
    "lib/**/*.rb",
    "sig/**/*.rbs",
    "ext/**/*.{c,h,rb}",
    "exe/*",
    "bin/*"
  ]

  spec.bindir = "exe"
  spec.executables = ["herb-lint"]
  spec.extensions = ["ext/herb-linter/extconf.rb"]

  spec.add_dependency "herb", Herb::Linter::VERSION

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.metadata["homepage_uri"] = "https://herb-tools.dev"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/herb/releases"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/herb"
  spec.metadata["bug_tracker_uri"] = "https://github.com/marcoroth/herb/issues"
  spec.metadata["documentation_uri"] = "https://docs.herb-tools.dev"
end
