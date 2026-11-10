# frozen_string_literal: true

require_relative "test_helper"

class HerbTest < Minitest::Spec
  test "version" do
    backend = defined?(Herb::FFI::Backend) ? "Ruby FFI backend" : "Ruby C native extension"

    assert_equal "herb gem v0.11.2, libprism v2.1.0+4691667, libherb v0.11.2 (#{backend})", Herb.version
  end

  test "ensure_installed requires available gems without loading bundler/inline" do
    bundler_inline_loaded = -> { $LOADED_FEATURES.any? { |feature| feature.end_with?("bundler/inline.rb") } }
    already_loaded = bundler_inline_loaded.call

    Herb.ensure_installed("parallel")

    assert defined?(Parallel)
    assert_equal already_loaded, bundler_inline_loaded.call
  end

  test "ensure_installed refuses to replace an active bundle for a missing gem" do
    error = assert_raises(LoadError) do
      Herb.ensure_installed("herb-test-gem-that-does-not-exist")
    end

    assert_equal 'Herb needs the `herb-test-gem-that-does-not-exist` gem. Add `gem "herb-test-gem-that-does-not-exist"` to the Gemfile.', error.message
  end
end
