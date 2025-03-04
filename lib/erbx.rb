# frozen_string_literal: true

require_relative "erbx/range"
require_relative "erbx/location"

require_relative "erbx/token"
require_relative "erbx/token_list"

require_relative "erbx/result"
require_relative "erbx/lex_result"
require_relative "erbx/parse_result"

require_relative "erbx/ast"
require_relative "erbx/ast/node"
require_relative "erbx/ast/nodes"

require_relative "erbx/cli"
require_relative "erbx/project"

require_relative "erbx/version"

begin
  require_relative "erbx/#{RUBY_VERSION.split(".")[...2].join(".")}/erbx"
rescue LoadError
  require "erbx/erbx"
end

module ERBX
end
