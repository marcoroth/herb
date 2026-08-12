# frozen_string_literal: true

require_relative "test_helper"

class HerbTest < Minitest::Spec
  test "version" do
    assert_equal "herb gem v0.10.3, libprism v1.9.0, libherb v0.10.3 (Ruby C native extension)", Herb.version
  end

  test "ensure_installed requires available gems without loading bundler/inline" do
    bundler_inline_loaded = -> { $LOADED_FEATURES.any? { |feature| feature.end_with?("bundler/inline.rb") } }
    already_loaded = bundler_inline_loaded.call

    Herb.ensure_installed("parallel")

    assert defined?(Parallel)
    assert_equal already_loaded, bundler_inline_loaded.call
  end
end
