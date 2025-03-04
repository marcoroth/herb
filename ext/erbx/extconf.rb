# frozen_string_literal: true

require "mkmf"

Dir.chdir(File.expand_path("../..", __dir__)) do
  system("rake templates", exception: true)
end

extension_name = "erbx"

include_path = File.expand_path("../../src/include", __dir__)
prism_path = `bundle show prism`.chomp

$VPATH << "$(srcdir)/../../src"

src_files = Dir.glob("#{$srcdir}/../../src/**/*.c").map { |n| File.basename(n) }.sort
$srcs = ["extension.c", "nodes.c", "extension_helpers.c"] + src_files

append_cppflags("-I#{prism_path}/include")
append_cppflags("-I#{include_path}")

abort("could not find prism.h") unless find_header("prism.h")
abort("could not find erbx.h") unless find_header("erbx.h")

abort("could not find nodes.h (run `ruby templates/template.rb` to generate the file)") unless find_header("nodes.h")
abort("could not find extension.h") unless find_header("extension.h")
abort("could not find extension_helpers.h") unless find_header("extension_helpers.h")

create_header
create_makefile("#{extension_name}/#{extension_name}")
