# frozen_string_literal: true

require "mkmf"
require "fileutils"

extension_name = "herb"
root_path = File.expand_path("../..", __dir__)

# When installing from a git source (e.g. `gem "herb", github: "..."`) generated
# files and the vendored Prism C source won't exist yet. Bootstrap them automatically.

# 1. Generate template files (nodes.c, error_helpers.c, ast_nodes.h, etc.)
unless File.exist?(File.join(__dir__, "nodes.c"))
  puts "Generated files not found — running template generation..."

  Dir.chdir(root_path) do
    require "pathname"
    require "set"
    require_relative "../../templates/template"

    Dir.glob("#{root_path}/templates/**/*.erb").each do |template|
      Herb::Template.render(template)
    end
  end
end

# 2. Vendor Prism C source (headers + implementation) if not present
prism_vendor_dir = File.join(root_path, "vendor", "prism")

unless File.directory?(File.join(prism_vendor_dir, "include"))
  puts "Vendored Prism not found — vendoring from installed gem..."

  begin
    prism_gem_path = Gem::Specification.find_by_name("prism").full_gem_path
  rescue Gem::MissingSpecError
    abort <<~MSG
      ERROR: The 'prism' gem is required to compile herb from a git source.

      Add it to your Gemfile before the herb git reference:

        gem "prism", "~> 1.9"
        gem "herb", github: "...", branch: "..."

      Then run `bundle install` again.
    MSG
  end

  FileUtils.mkdir_p(prism_vendor_dir)

  %w[config.yml Rakefile src/ include/ templates/].each do |entry|
    source = File.join(prism_gem_path, entry)
    next unless File.exist?(source)

    FileUtils.cp_r(source, prism_vendor_dir)
  end

  # Prism's own generated header (ast.h) may need to be created
  unless File.exist?(File.join(prism_vendor_dir, "include", "prism", "ast.h"))
    puts "Generating Prism template files..."
    system("ruby #{prism_vendor_dir}/templates/template.rb", exception: true)
  end
end

include_path = File.expand_path("../../src/include", __dir__)
prism_path = File.expand_path("../../vendor/prism", __dir__)

prism_src_path = "#{prism_path}/src"
prism_include_path = "#{prism_path}/include"

$VPATH << "$(srcdir)/../../src"
$VPATH << "$(srcdir)/../../src/analyze"
$VPATH << "$(srcdir)/../../src/analyze/action_view"
$VPATH << "$(srcdir)/../../src/util"
$VPATH << prism_src_path
$VPATH << "#{prism_src_path}/util"

$INCFLAGS << " -I#{prism_include_path}"
$INCFLAGS << " -I#{include_path}"
$INCFLAGS << " -I#{prism_src_path}"
$INCFLAGS << " -I#{prism_src_path}/util"

$CFLAGS << " -fvisibility=hidden"
$CFLAGS << " -DHERB_EXCLUDE_PRETTYPRINT"
$CFLAGS << " -DPRISM_EXCLUDE_PRETTYPRINT"
$CFLAGS << " -DPRISM_EXCLUDE_JSON"
$CFLAGS << " -DPRISM_EXCLUDE_PACK"

herb_src_files = Dir.glob("#{$srcdir}/../../src/**/*.c").map { |file| file.delete_prefix("../../../../ext/herb/") }.sort

prism_main_files = [
  "diagnostic.c",
  "encoding.c",
  "node.c",
  "options.c",
  "pack.c",
  "prettyprint.c",
  "prism.c",
  "regexp.c",
  "serialize.c",
  "static_literals.c",
  "token_type.c"
]

prism_util_files = [
  "pm_buffer.c",
  "pm_char.c",
  "pm_constant_pool.c",
  "pm_integer.c",
  "pm_list.c",
  "pm_memchr.c",
  "pm_newline_list.c",
  "pm_string.c",
  "pm_strncasecmp.c",
  "pm_strpbrk.c"
]

core_src_files = [
  "extension.c",
  "nodes.c",
  "error_helpers.c",
  "extension_helpers.c"
]

$srcs = core_src_files + herb_src_files + prism_main_files + prism_util_files

puts "Sources to be compiled: #{$srcs.inspect}"

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find herb.h") unless find_header("herb.h")

abort("could not find nodes.h (run `ruby templates/template.rb` to generate the file)") unless find_header("nodes.h")
abort("could not find extension.h") unless find_header("extension.h")
abort("could not find extension_helpers.h") unless find_header("extension_helpers.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
