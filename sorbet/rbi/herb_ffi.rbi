# typed: false

# lib/herb/ffi* is ignored in sorbet/config, so declare what other files use.
module Herb
  module FFI
    class StaleLibraryError < LoadError; end
  end
end
