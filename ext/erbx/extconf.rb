require "mkmf"

lib_path = File.expand_path("../../", __dir__)
include_path = File.expand_path("../../src/include", __dir__)

dir_config("erbx", include_path, lib_path)

unless find_header("erbx.h", include_path)
  abort "erbx.h can't be found"
end

unless find_library("erbx", "erbx_compile_file", lib_path, "-Wl,-rpath,#{lib_path}")
  abort "liberbx.so can't be found"
end

create_header
create_makefile("erbx/erbx")
