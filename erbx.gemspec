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

  gemspec = File.basename(__FILE__)
  spec.files = IO.popen(%w[git ls-files -z], chdir: __dir__, err: IO::NULL) do |ls|
    ls.readlines("\x0", chomp: true).reject do |f|
      (f == gemspec) ||
        f.start_with?(*%w[bin/ test/ spec/ features/ .git .github appveyor Gemfile])
    end
  end

  spec.extensions = ["ext/erbx/extconf.rb"]

  spec.metadata["allowed_push_host"] = "https://rubygems.org"
  spec.metadata["source_code_uri"] = "https://github.com/marcoroth/erbx"
  spec.metadata["changelog_uri"] = "https://github.com/marcoroth/erbx/releases"
  spec.metadata["rubygems_mfa_required"] = "true"

  spec.add_dependency "ffi"
end
