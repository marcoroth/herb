require "mkmf"

extension_name = "erbx"
include_path = File.expand_path("../../src/include", __dir__)

dir_config(extension_name, include_path)

unless find_header("#{extension_name}.h", include_path)
  abort "#{extension_name}.h can't be found"
end

create_header
create_makefile("#{extension_name}/#{extension_name}")
