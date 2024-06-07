# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name = "erbx"
  spec.version = "0.0.1"
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "HTML-aware ERB parser"
  spec.homepage = "https://github.com/marcoroth/erbx"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.0.0"

  spec.require_paths = ["lib"]
  spec.files = [
    "ext/erbx/extension.c",
    "lib/erbx.rb",
    "lib/erbx/version.rb"
  ]

  spec.extensions = ["ext/erbx/extconf.rb"]
  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/erbx"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/erbx/releases"

  spec.add_dependency "ffi"

  spec.add_development_dependency "rake", "~> 13.2"
  spec.add_development_dependency "rake-compiler", "~> 1.2"
  spec.add_development_dependency "maxitest"
end
