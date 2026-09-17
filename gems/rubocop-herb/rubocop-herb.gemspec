# frozen_string_literal: true

require_relative "../../lib/herb/version"

Gem::Specification.new do |spec|
  spec.name = "rubocop-herb"
  spec.version = Herb::VERSION
  spec.authors = ["Marco Roth"]
  spec.email = ["marco.roth@intergga.ch"]

  spec.summary = "Run RuboCop against Ruby embedded in Herb templates"
  spec.description = "A RuboCop plugin that uses Herb to extract Ruby from ERB templates."
  spec.homepage = "https://herb-tools.dev"
  spec.license = "MIT"

  spec.required_ruby_version = ">= 3.2.0"
  spec.require_paths = ["lib"]
  spec.files = Dir.chdir(__dir__) do
    Dir[
      "README.md",
      "config/**/*.yml",
      "lib/**/*.rb"
    ]
  end

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["rubygems_mfa_required"] = "true"
  spec.metadata["default_lint_roller_plugin"] = "RuboCop::Herb::Plugin"
  spec.metadata["homepage_uri"] = "https://herb-tools.dev"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/herb"
  spec.metadata["bug_tracker_uri"] = "https://github.com/marcoroth/herb/issues"

  spec.add_dependency "herb", "= #{Herb::VERSION}"
  spec.add_dependency "lint_roller", "~> 1.1"
  spec.add_dependency "rubocop", ">= 1.72.1", "< 2"
end
