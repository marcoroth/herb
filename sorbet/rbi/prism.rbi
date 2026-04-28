# typed: true

# Shim for Prism::LexCompat which was removed in newer versions
# but is still referenced in the vendored prism RBI files.
module Prism
  module LexCompat
    Result = Prism::LexResult
  end
end
