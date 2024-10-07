require "mkmf"

extension_name = "erbx"
include_path = File.expand_path("../../src/include", __dir__)

dir_config(extension_name, include_path)

unless find_header("#{extension_name}.h", include_path)
  abort "#{extension_name}.h can't be found"
end

# expected_functions = [
#   "erbx_lex",
#   "erbx_lex_file",
# ]
#
# expected_functions.each do |expected_function|
#   unless find_library(extension_name, expected_function)
#     abort "lib#{extension_name}.so can't be found or #{expected_function}() not defined in it"
#   end
# end

create_header
create_makefile("#{extension_name}/#{extension_name}")
