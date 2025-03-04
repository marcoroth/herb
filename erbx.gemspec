# frozen_string_literal: true

begin
  require_relative "lib/erbx/version"
rescue LoadError
  puts "WARNING: Could not load ERBX::VERSION"
end

Gem::Specification.new do |spec|
  spec.name = "erbx"
  spec.version = defined?(ERBX::VERSION) ? ERBX::VERSION : "0.0.0"
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "Seamless and powerful HTML+ERB parsing."
  spec.description = spec.summary
  spec.homepage = "https://github.com/marcoroth/erbx"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.0.0"
  spec.require_paths = ["lib"]

  spec.files = Dir[
    "erbx.gemspec",
    "License.txt",
    "Makefile",
    "Rakefile",
    "README.md",
    "lib/**/*.rb",
    "src/**/*.{c,h}",
    "ext/**/*.{c,h}",
    "exe/*"
  ]

  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.extensions = ["ext/erbx/extconf.rb"]

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/erbx"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/erbx/releases"
  spec.metadata["rubygems_mfa_required"] = "true"

  # spec.add_dependency "ffi"
end
