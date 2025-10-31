# frozen_string_literal: true

begin
  require_relative "lib/herb/version"
rescue LoadError
  puts "WARNING: Could not load Herb::VERSION"
end

Gem::Specification.new do |spec|
  spec.name = "herb"
  spec.version = defined?(Herb::VERSION) ? Herb::VERSION : "0.0.0"
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "Powerful and seamless HTML-aware ERB parsing and tooling."
  spec.description = spec.summary
  spec.homepage = "https://herb-tools.dev"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.0.0"
  spec.require_paths = ["lib"]

  spec.files = Dir[
    "herb.gemspec",
    "LICENSE.txt",
    "Makefile",
    "Rakefile",
    "README.md",
    "config.yml",
    "lib/**/*.rb",
    "sig/**/*.rbs",
    "src/**/*.{c,h}",
    "ext/**/*.{c,h}",
    "templates/**/*.{rb,erb}",
    "vendor/prism/**/*",
    "exe/*"
  ]

  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.extensions = ["ext/herb/extconf.rb"]

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.metadata["homepage_uri"] = "https://herb-tools.dev"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/herb/releases"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/herb"
  spec.metadata["bug_tracker_uri"] = "https://github.com/marcoroth/herb/issues"
  spec.metadata["documentation_uri"] = "https://docs.herb-tools.dev"

  # spec.add_dependency "ffi"
end
