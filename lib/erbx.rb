# frozen_string_literal: true

require "erbx/range"
require "erbx/location"

require "erbx/token"
require "erbx/token_list"

require "erbx/result"
require "erbx/lex_result"
require "erbx/parse_result"

require "erbx/ast"
require "erbx/ast/node"
require "erbx/ast/nodes"

require_relative "erbx/version"

begin
  require_relative "erbx/#{RUBY_VERSION.split(".")[...2].join(".")}/erbx"
rescue LoadError
  require "erbx/erbx"
end

module ERBX
end
