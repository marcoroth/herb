# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "herb"
require "pathname"
require "maxitest/autorun"
require "minitest/spec"

require_relative "fork_helper" if ENV["NO_TIMEOUT"].nil?

require_relative "snapshot_utils"

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)

class Minitest::Test
  def setup
    super

    @__original_herb_backend = Herb.current_backend

    Herb.switch_backend(:native) unless Herb.current_backend == :native
  end

  def teardown
    if @__original_herb_backend && @__original_herb_backend != Herb.current_backend
      Herb.switch_backend(@__original_herb_backend)
    end

    super
  end
end

def cyclic_string(length)
  sequence = ("a".."z").to_a + ("0".."9").to_a
  sequence.cycle.take(length).join
end

module Analyze
  module ActionView
  end
end
