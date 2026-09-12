#!/usr/bin/env ruby
# frozen_string_literal: true

# herb-rails-write-config — idempotently write or update .herb.yml.
# Existing keys are preserved; only missing keys are filled in.
#
# Usage:
#   herb-rails-write-config.rb --profile=minimal|recommended|full [--path=PATH]
#
# Exit codes:
#   0 wrote or updated the file (idempotent)
#   1 invalid arguments / cannot write

require "yaml"
require "fileutils"
require "optparse"

profile = "recommended"
path    = File.join(Dir.pwd, ".herb.yml")

OptionParser.new do |opts|
  opts.banner = "Usage: herb-rails-write-config.rb [options]"
  opts.on("--profile=PROFILE", %w[minimal recommended full]) { |v| profile = v }
  opts.on("--path=PATH")                                     { |v| path    = v }
end.parse!(ARGV)

defaults = {
  "framework" => (profile == "minimal" ? "ruby" : "actionview"),
  "template_engine" => "erubi",
  "engine" => {
    "validators" => {
      "security"      => true,
      "nesting"       => true,
      "accessibility" => true,
    },
  },
  "linter" => {
    "enabled"   => true,
    "failLevel" => "warning",
    "exclude"   => ["vendor/**/*", "node_modules/**/*"],
  },
  "formatter" => {
    "enabled"       => false,
    "indentWidth"   => 2,
    "maxLineLength" => 80,
  },
}

def deep_merge_missing(existing, defaults)
  defaults.each do |k, v|
    if existing.key?(k)
      if existing[k].is_a?(Hash) && v.is_a?(Hash)
        deep_merge_missing(existing[k], v)
      end
    else
      existing[k] = v
    end
  end
  existing
end

load_yaml = lambda do |p|
  return {} unless File.exist?(p)
  if YAML.respond_to?(:safe_load_file)
    YAML.safe_load_file(p) || {}
  else
    YAML.safe_load(File.read(p)) || {}
  end
end
existing = load_yaml.call(path)
unless existing.is_a?(Hash)
  warn "#{path} is not a YAML mapping — refusing to overwrite."
  exit 1
end

before  = existing.dup
merged  = deep_merge_missing(existing, defaults)
changed = before != merged || !File.exist?(path)

header = <<~YAML
  # Herb configuration. Read by `bundle exec herb`, the LSP, and the @herb-tools/* npm packages.
  # See: https://github.com/marcoroth/herb and HERB-IN-RAILS.md
YAML

FileUtils.mkdir_p(File.dirname(path))
File.write(path, header + YAML.dump(merged))

if changed
  puts "wrote #{path} (profile: #{profile})"
else
  puts "no changes to #{path} (already configured)"
end

exit 0
