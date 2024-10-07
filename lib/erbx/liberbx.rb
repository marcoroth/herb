# frozen_string_literal: true

require "ffi"
require "rbconfig"

module ERBX
  module LibERBX
    extend FFI::Library

    def self.library_extension
      RbConfig::CONFIG["DLEXT"]
    end

    def self.library_name
      "liberbx.#{library_extension}"
    end

    def self.library_path
      File.expand_path("../../#{library_name}", __dir__)
    end

    ffi_lib(library_path)

    attach_function :erbx_lex_to_buffer, [:pointer, :pointer], :void
    attach_function :erbx_lex, [:pointer], :pointer
    attach_function :erbx_version, [], :pointer
  end
end
