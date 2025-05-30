# frozen_string_literal: true
# typed: ignore

require "ffi"
require "rbconfig"

module Herb
  module LibHerb
    extend FFI::Library

    def self.library_extension
      RbConfig::CONFIG["DLEXT"]
    end

    def self.library_name
      "libherb.#{library_extension}"
    end

    def self.library_path
      File.expand_path("../../#{library_name}", __dir__)
    end

    ffi_lib(library_path)

    attach_function :herb_lex_to_buffer, [:pointer, :pointer], :void
    attach_function :herb_lex_json_to_buffer, [:pointer, :pointer], :void
    attach_function :herb_lex, [:pointer], :pointer
    attach_function :herb_parse, [:pointer], :pointer
    attach_function :herb_extract_ruby_to_buffer, [:pointer, :pointer], :void
    attach_function :herb_extract_html_to_buffer, [:pointer, :pointer], :void
    attach_function :herb_version, [], :pointer
  end
end
