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

  test "native extension works in concurrent ractors" do
    ractors = 4.times.map do |index|
      Ractor.new(index) do |ractor_index|
        source = "<p>Ractor #{ractor_index}</p>"

        [
          Herb.parse(source).success?,
          Herb.lex(source).success?,
          !Herb.extract_html("<p><%= ractor_index %></p>").include?("<%="),
          Herb.extract_ruby("<p><%= ractor_index %></p>").include?("ractor_index"),
          Herb.diff(source, source).identical?,
          Herb.version.include?("Ruby C native extension")
        ]
      end
    end
    results = ractors.map { |ractor| ractor.respond_to?(:value) ? ractor.value : ractor.take }

    assert_equal Array.new(4) { [true, true, true, true, true, true] }, results
  end
end
