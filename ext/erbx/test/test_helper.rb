# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "erbx"
require "pathname"
require "maxitest/autorun"

module Minitest
  class Spec
    class << self
      alias test it
      alias xtest xit
    end
  end
end
