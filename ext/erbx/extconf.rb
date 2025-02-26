# frozen_string_literal: true

require "mkmf"

extension_name = "erbx"
include_path = File.expand_path("../../src/include", __dir__)

$VPATH << "$(srcdir)/../../src"

src_files = Dir.glob("#{$srcdir}/../../src/**/*.c").map { |n| File.basename(n) }.sort
$srcs = ["extension.c"] + src_files

prism_path = `bundle show prism`.chomp
prism_lib_path = "#{prism_path}/build"
append_cppflags("-I#{prism_path}/include")

append_cppflags("-I#{include_path}")

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find erbx.h") unless find_header("erbx.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
