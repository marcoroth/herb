# frozen_string_literal: true

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

require_relative "herb/cli"
require_relative "herb/project"

require_relative "herb/version"

begin
  require_relative "herb/#{RUBY_VERSION.split(".")[...2].join(".")}/herb"
rescue LoadError
  require_relative "herb/herb"
end

module Herb
end
