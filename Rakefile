# frozen_string_literal: true

require "English"
require "bundler/gem_tasks"
require "rake/extensiontask"
require "rake/testtask"

Rake::ExtensionTask.new do |ext|
  ext.name = "erbx"
  ext.source_pattern = "*.{c,h}"
  ext.ext_dir = "ext/erbx"
  ext.lib_dir = "lib/erbx"
  ext.gem_spec = Gem::Specification.load("erbx.gemspec")
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

desc "Render out template files"
task :templates do
  require_relative "templates/template"

  Dir.glob("templates/**/*.erb").each do |template|
    puts "Rendering template #{template} ..."

    ERBX::Template.render(template)
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
      (added + modified).each do |template|
        template_file = template.delete_prefix("#{__dir__}/")

        puts "#{Time.now.strftime("[%Y-%m-%d %H:%M:%S]")} Detected change, regenerating #{template_file} ..."
        ERBX::Template.render(template_file)
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

task default: [:templates, :compile, :test]
