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

require_relative "herb/errors"
require_relative "herb/warnings"

require_relative "herb/cli"
require_relative "herb/project"

require_relative "herb/version"

require_relative "herb/visitor"

begin
  major, minor, _patch = RUBY_VERSION.split(".") #: [String, String, String]
  require_relative "herb/#{major}.#{minor}/herb"
rescue LoadError
  require_relative "herb/herb"
end

module Herb
  # HTML escape function for engine
  ESCAPE_TABLE = {
    "&" => "&amp;",
    "<" => "&lt;",
    ">" => "&gt;",
    '"' => "&quot;",
    "'" => "&#39;",
  }.freeze

  def self.h(value)
    value.to_s.gsub(/[&<>"']/, ESCAPE_TABLE)
  end
end
