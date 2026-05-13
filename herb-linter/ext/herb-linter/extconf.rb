# frozen_string_literal: true

require "mkmf"

extension_name = "herb_linter"

linter_include_path = File.expand_path("../../../rust/herb-linter/include", __dir__)
linter_lib_path = File.expand_path("../../../rust/target/release", __dir__)
linter_lib_file = File.join(linter_lib_path, "libherb_linter.a")

unless File.exist?(linter_lib_file)
  linter_lib_path = File.expand_path("../../../rust/target/debug", __dir__)
  linter_lib_file = File.join(linter_lib_path, "libherb_linter.a")
end

unless File.exist?(linter_lib_file)
  abort <<~MSG
    ERROR: Could not find the Rust linter library (libherb_linter.a).

    Build it first:
      cd rust && cargo build -p herb-linter

    Or for a release build:
      cd rust && cargo build -p herb-linter --release
  MSG
end

$INCFLAGS << " -I#{linter_include_path}"
$LDFLAGS << " #{linter_lib_file}"
$CFLAGS << " -fvisibility=hidden"
$srcs = ["herb_linter.c"]

create_header
create_makefile("herb/linter/#{extension_name}")
