#!/usr/bin/env ruby
# frozen_string_literal: true

#
# Executable of the herb-linter, herb-formatter and herb-highlighter gems. Runs the standalone
# executable in the gem's libexec, or the npm package with npx on platforms without one.
#

PACKAGES = {
  "herb-lint" => "@herb-tools/linter",
  "herb-format" => "@herb-tools/formatter",
  "herb-highlight" => "@herb-tools/highlighter",
}.freeze

NPX_COMMANDS = ["npx", "npx.cmd"].freeze

name = File.basename(__FILE__)
package = PACKAGES.fetch(name)
executable = File.expand_path("../libexec/#{name}#{".exe" if Gem.win_platform?}", __dir__)

exec(executable, *ARGV) if File.exist?(executable)

npx = ENV.fetch("PATH", "").split(File::PATH_SEPARATOR).any? { |directory|
  NPX_COMMANDS.any? { |command| File.executable?(File.join(directory, command)) }
}

if npx
  warn "There's no standalone #{name} executable for this platform (#{Gem::Platform.local}), using npx #{package}"
  exec("npx", package, *ARGV)
else
  warn "There's no standalone #{name} executable for this platform (#{Gem::Platform.local})."
  warn "Install Node.js and the npm package instead: npm install #{package}"
  exit 1
end
