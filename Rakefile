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
  t.test_files = FileList["ext/erbx/test/**/*_test.rb"]
end

Rake::Task[:compile].enhance do
  IO.popen("make") do |output|
    output.each_line do |line|
      puts "#{line}"
    end
  end

  if $?.exitstatus != 0
    raise "src/* could not be compiled #{$?.exitstatus}"
  end
end


Rake::Task[:clean].enhance do
  IO.popen("make clean") do |output|
    output.each_line do |line|
      puts "#{line}"
    end
  end
end

task default: [:compile, :test]
