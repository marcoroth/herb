# typed: false

# lib/herb/ffi* is ignored in sorbet/config, so declare what other files use.
module Herb
  module FFI
    class StaleLibraryError < LoadError; end

    def self.ruby_syntax_errors(source); end
  end
end
