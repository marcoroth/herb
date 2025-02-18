# frozen_string_literal: true

require "English"
require "bundler/gem_tasks"
require "rake/extensiontask"
require "rake/testtask"

PLATFORMS = %w[
  aarch64-linux-gnu
  aarch64-linux-musl
  arm-linux-gnu
  arm-linux-musl
  arm64-darwin
  x86_64-darwin
  x86_64-linux-gnu
  x86_64-linux-musl
  x86-linux-gnu
  x86-linux-musl
].freeze

exttask = Rake::ExtensionTask.new do |ext|
  ext.name = "erbx"
  ext.source_pattern = "*.{c,h}"
  ext.ext_dir = "ext/erbx"
  ext.lib_dir = "lib/erbx"
  ext.gem_spec = Gem::Specification.load("erbx.gemspec")
  ext.cross_compile = true
  ext.cross_platform = PLATFORMS
end

Rake::TestTask.new(:test) do |t|
  t.libs << "test"
  t.libs << "lib"
  t.test_files = FileList["test/**/*_test.rb"]
end

Rake::Task[:compile].enhance do
  IO.popen("make") do |output|
    output.each_line do |line|
      puts line
    end
  end

  raise "src/* could not be compiled #{$CHILD_STATUS.exitstatus}" if $CHILD_STATUS.exitstatus != 0
end

Rake::Task[:clean].enhance do
  IO.popen("make clean") do |output|
    output.each_line do |line|
      puts line
    end
  end
end

task "gem:native" do
  require "rake_compiler_dock"
  sh "bundle package --all"

  PLATFORMS.each do |plat|
    RakeCompilerDock.sh "bundle --local && rake native:#{plat} gem", platform: plat
  end

  RakeCompilerDock.sh "bundle --local && rake java gem", rubyvm: :jruby
end

namespace "gem" do
  task "prepare" do
    require "rake_compiler_dock"
    require "io/console"

    sh "bundle package --all"
    sh "cp ~/.gem/gem-*.pem build/gem/ || true"

    # ENV["GEM_PRIVATE_KEY_PASSPHRASE"] = STDIN.getpass("Enter passphrase of gem signature key: ")
  end

  exttask.cross_platform.each do |plat|
    desc "Build all native binary gems in parallel"
    multitask "native" => plat

    desc "Build the native gem for #{plat}"
    task plat => "prepare" do
      # RakeCompilerDock.sh <<-EOT, platform: plat
      #   (cp build/gem/gem-*.pem ~/.gem/ || true) &&
      #   bundle --local &&
      #   rake native:#{plat} pkg/#{exttask.gem_spec.full_name}-#{plat}.gem
      # EOT
      RakeCompilerDock.sh "bundle --local && rake native:#{plat} gem", platform: plat
    end
  end
end

task default: [:compile, :test]
