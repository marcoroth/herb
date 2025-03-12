# frozen_string_literal: true

require "English"
require "bundler/gem_tasks"
require "rake/testtask"

Rake::TestTask.new(:test) do |t|
  t.libs << "test"
  t.libs << "lib"
  t.test_files = FileList["test/**/*_test.rb"]
end

task "make" do
  puts "Running make..."
  IO.popen("make") do |output|
    output.each_line do |line|
      puts line
    end
  end
end

begin
  require "rake/extensiontask"

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

  Rake::Task[:compile].enhance do
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
    sh "bundle config set cache_all true"

    PLATFORMS.each do |platform|
      RakeCompilerDock.sh "bundle --local && rake native:#{platform} gem", platform: platform
    end

    RakeCompilerDock.sh "bundle --local && rake java gem", rubyvm: :jruby
  rescue LoadError
    abort "rake_compiler_dock is required to build native gems"
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
    rescue LoadError
      abort "rake_compiler_dock is required for this task"
    end

    exttask.cross_platform.each do |platform|
      desc "Build all native binary gems in parallel"
      multitask "native" => platform

      desc "Build the native gem for #{platform}"
      task platform => "prepare" do
        RakeCompilerDock.sh(
          "bundle --local && rake native:#{platform} gem RUBY_CC_VERSION='#{ENV.fetch("RUBY_CC_VERSION", nil)}'",
          platform: platform
        )
      end
    end
  end
rescue LoadError => e
  desc "Compile task not available (rake-compiler not installed)"
  task :compile do
    puts e
    abort <<~MESSAGE

      "rake-compiler is required for this task.

      Are you running `rake` using `bundle exec rake`?

      Otherwise
        * try to run bundle install
        * add it to your Gemfile
        * or install it with: gem install rake-compiler
    MESSAGE
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
  rescue LoadError
    abort "listen gem is required for this task. Add it to your Gemfile or install it with: gem install listen"
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
