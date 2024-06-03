require "bundler/gem_tasks"
require "rake/extensiontask"

Rake::ExtensionTask.new do |ext|
  ext.name = "erbx"
  ext.source_pattern = "*.{c,h}"
  ext.ext_dir = "ext/erbx"
  ext.lib_dir = "lib/erbx"
  ext.gem_spec = Gem::Specification.load("erbx.gemspec")
end

task default: [:compile]
