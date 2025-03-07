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
  ext.name = "herb"
  ext.source_pattern = "*.{c,h}"
  ext.ext_dir = "ext/herb"
  ext.lib_dir = "lib/herb"
  ext.gem_spec = Gem::Specification.load("herb.gemspec")
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

task "make" do
  puts "Running make..."
  IO.popen("make") do |output|
    output.each_line do |line|
      puts line
    end
  end
end

task "gem:native" do
  require "rake_compiler_dock"
  sh "bundle config set cache_all true"

  PLATFORMS.each do |platform|
    RakeCompilerDock.sh "bundle --local && rake native:#{platform} gem", platform: platform
  end

  RakeCompilerDock.sh "bundle --local && rake java gem", rubyvm: :jruby
end

namespace "gem" do
  task "prepare" do
    require "rake_compiler_dock"
    require "io/console"

    sh "bundle config set cache_all true"
    sh "cp ~/.gem/gem-*.pem build/gem/ || true"

    gemspec_path = File.expand_path("./herb.gemspec", __dir__)
    spec = eval(File.read(gemspec_path), binding, gemspec_path)

    RakeCompilerDock.set_ruby_cc_version(spec.required_ruby_version.as_list)

    # ENV["GEM_PRIVATE_KEY_PASSPHRASE"] = STDIN.getpass("Enter passphrase of gem signature key: ")
  end

  exttask.cross_platform.each do |platform|
    desc "Build all native binary gems in parallel"
    multitask "native" => platform

    desc "Build the native gem for #{platform}"
    task platform => "prepare" do
      # RakeCompilerDock.sh <<-EOT, platform: plat
      #   (cp build/gem/gem-*.pem ~/.gem/ || true) &&
      #   bundle --local &&
      #   rake native:#{plat} pkg/#{exttask.gem_spec.full_name}-#{plat}.gem
      # EOT

      RakeCompilerDock.sh(
        "bundle --local && rake native:#{platform} gem RUBY_CC_VERSION='#{ENV.fetch("RUBY_CC_VERSION", nil)}'",
        platform: platform
      )
    end
  end
end

desc "Render out template files"
task :templates do
  require_relative "templates/template"

  Dir.glob("#{__dir__}/templates/**/*.erb").each do |template|
    Herb::Template.render(template)
  end
end

namespace :templates do
  desc "Watch template files and regenerate on changes"
  task :watch do
    require "listen"

    Rake::Task[:templates].execute

    puts
    puts "Watching config.yml and templates/**/*.erb for changes..."

    ignore = Dir.glob("*/").map { |dir| Regexp.escape(dir.chomp("/")) }.map { |dir| %r{^#{dir}/} }

    config_listener = Listen.to(".", only: /config\.yml$/, ignore: ignore) do
      puts
      puts "#{Time.now.strftime("[%Y-%m-%d %H:%M:%S]")} config.yml changed, regenerating all templates ..."
      puts

      Rake::Task[:templates].execute
    end

    template_listener = Listen.to("templates", only: /\.erb$/) do |modified, added, removed|
      puts
      (added + modified).each do |template|
        template_file = template.delete_prefix("#{__dir__}/")

        puts "#{Time.now.strftime("[%Y-%m-%d %H:%M:%S]")} Detected change, regenerating #{template_file} ..."
        Herb::Template.render(template_file)
      end

      removed.each do |template|
        puts
        puts "#{template} was removed. Make sure to also remove the generated file."
      end
    end

    config_listener.start
    template_listener.start

    sleep
  end
end

namespace :parse do
  desc "Parse ERB files in a project directory"
  task :project, [:path, :output_file] do |_t, args|
    require_relative "lib/herb"

    Herb::Project.new(args[:path], output_file: args[:output_file]).parse!
  end
end

task default: [:templates, :make, :compile, :test]
