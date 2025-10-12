# frozen_string_literal: true
# typed: false

require_relative "herb/range"
require_relative "herb/position"
require_relative "herb/location"

require_relative "herb/token"
require_relative "herb/token_list"

require_relative "herb/result"
require_relative "herb/lex_result"
require_relative "herb/parse_result"

require_relative "herb/ast"
require_relative "herb/ast/node"
require_relative "herb/ast/nodes"
require_relative "herb/ast/helpers"

require_relative "herb/errors"
require_relative "herb/warnings"

require_relative "herb/cli"
require_relative "herb/project"

require_relative "herb/version"

require_relative "herb/visitor"
require_relative "herb/engine"

begin
  # Try to load the C extension for the current Ruby version.
  major, minor, = RUBY_VERSION.split(".").map(&:to_i)
  require_relative "herb/#{major}.#{minor}/herb"
rescue LoadError
  # Fall back to the generic C extension if the version-specific one fails to load.
  require_relative "herb/herb"
end

module Herb
end
