# frozen_string_literal: true

require "mkmf"

extension_name = "herb"

include_path = File.expand_path("../../src/include", __dir__)
prism_path = File.expand_path("../../vendor/prism", __dir__)

prism_src_path = "#{prism_path}/src"
prism_include_path = "#{prism_path}/include"

$VPATH << "$(srcdir)/../../src"
$VPATH << "$(srcdir)/../../src/util"
$VPATH << prism_src_path
$VPATH << "#{prism_src_path}/util"

linter_include_path = File.expand_path("../../rust/herb-linter/include", __dir__)
linter_lib_path = File.expand_path("../../rust/target/debug", __dir__)
linter_lib_file = "#{linter_lib_path}/libherb_linter.a"
has_linter = File.exist?(linter_lib_file)

$INCFLAGS << " -I#{prism_include_path}"
$INCFLAGS << " -I#{include_path}"
$INCFLAGS << " -I#{prism_src_path}"
$INCFLAGS << " -I#{prism_src_path}/util"

if has_linter
  $INCFLAGS << " -I#{linter_include_path}"
  $LDFLAGS << " #{linter_lib_file}"
  $CFLAGS << " -DHAS_HERB_LINTER"
  puts "Linter support: enabled (found #{linter_lib_file})"
else
  puts "Linter support: disabled (#{linter_lib_file} not found)"
end

$CFLAGS << " -fvisibility=hidden"

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

core_src_files << "linter.c" if has_linter

$srcs = core_src_files + herb_src_files + prism_main_files + prism_util_files

puts "Sources to be compiled: #{$srcs.inspect}"

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find herb.h") unless find_header("herb.h")

abort("could not find nodes.h (run `ruby templates/template.rb` to generate the file)") unless find_header("nodes.h")
abort("could not find extension.h") unless find_header("extension.h")
abort("could not find extension_helpers.h") unless find_header("extension_helpers.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
