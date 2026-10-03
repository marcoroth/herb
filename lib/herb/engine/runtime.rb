# frozen_string_literal: true
# typed: true

require_relative "runtime/report"
require_relative "runtime/entry"
require_relative "runtime/session"
require_relative "runtime/html_safe_assertions"

module Herb
  class Engine
    # Everything a compiled template talks to while it renders.
    #
    # A constant under here is named by generated Ruby, so an application serving templates that
    # were compiled ahead of time needs this and nothing else the engine ships:
    #
    #     require "herb/engine/runtime"
    #
    module Runtime
    end
  end
end
