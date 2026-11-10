# frozen_string_literal: true

require_relative "../../lib/herb/bootstrap"

extension_name = "herb"

if Herb::Bootstrap.git_source? && !Herb::Bootstrap.templates_generated?
  puts "Building from source — running bootstrap..."

  unless Herb::Bootstrap.prism_vendored?
    prism_path = Herb::Bootstrap.find_prism_gem_path

    # TODO: Point this back at the `ruby/prism` release tag the `Gemfile` uses once it moves off the fork.
    abort <<~MSG unless prism_path
      ERROR: Could not find Prism C source files.

      When installing Herb from a git source, a git-sourced Prism is required
      (the released gem does not include C source files).

      Add it to your Gemfile before the herb git reference:

        gem "prism", github: "marcoroth/prism", ref: "4691667e2215831ae855add71d9925c0b871a709"
        gem "herb", github: "...", branch: "..."

      Then run `bundle install` again.
    MSG

    puts "Vendoring Prism from #{prism_path}..."
    Herb::Bootstrap.vendor_prism(prism_gem_path: prism_path)
  end

  Herb::Bootstrap.generate_templates
  git_build = true
end

git_cflags = git_build ? Herb::Bootstrap.git_build_cflags : []

if RUBY_ENGINE == "jruby"
  puts "Built #{Herb::Bootstrap.build_ffi_library(cflags: git_cflags)}"
  File.write("Makefile", "all install clean:\n\t@:\n")
  return
end

require "mkmf"
require "shellwords"

include_path = File.expand_path("../../src/include", __dir__)
prism_path = File.expand_path("../../vendor/prism", __dir__)

prism_src_path = "#{prism_path}/src"
prism_include_path = "#{prism_path}/include"

$VPATH << "$(srcdir)/../../src"
$VPATH << "$(srcdir)/../../src/analyze"
$VPATH << "$(srcdir)/../../src/analyze/action_view"
$VPATH << "$(srcdir)/../../src/ast"
$VPATH << "$(srcdir)/../../src/diff"
$VPATH << "$(srcdir)/../../src/lexer"
$VPATH << "$(srcdir)/../../src/location"
$VPATH << "$(srcdir)/../../src/parser"
$VPATH << "$(srcdir)/../../src/prism"
$VPATH << "$(srcdir)/../../src/lib"
$VPATH << "$(srcdir)/../../src/util"

$INCFLAGS << " -I#{prism_include_path}"
$INCFLAGS << " -I#{include_path}"
$INCFLAGS << " -I#{prism_src_path}"

$CFLAGS << " #{Shellwords.join(Herb::Bootstrap::CFLAGS + git_cflags)}"

herb_src_files = Dir.glob("#{$srcdir}/../../src/**/*.c").map { |file| file.delete_prefix("../../../../ext/herb/") }.sort

prism_src_files = Dir.glob("#{prism_src_path}/*.c").map do |file|
  wrapper = "prism_#{File.basename(file)}"
  File.write(wrapper, "#include \"#{file}\"\n")
  wrapper
end

core_src_files = [
  "extension.c",
  "nodes.c",
  "error_helpers.c",
  "extension_helpers.c",
  "parser_options_helpers.c"
]

$srcs = core_src_files + herb_src_files + prism_src_files

puts "Sources to be compiled: #{$srcs.inspect}"

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find herb.h") unless find_header("herb.h")

abort("could not find nodes.h (run `ruby templates/template.rb` to generate the file)") unless find_header("nodes.h")
abort("could not find extension.h") unless find_header("extension.h")
abort("could not find extension_helpers.h") unless find_header("extension_helpers.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
