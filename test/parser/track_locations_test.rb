# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TrackLocationsTest < Minitest::Spec
    include SnapshotUtils

    SOURCE = %(<div class="hello"><%= greeting %></div>\n)

    test "locations are tracked by default" do
      result = Herb.parse(SOURCE)
      element = result.value.children.first

      assert_instance_of Herb::Location, result.value.location
      assert_instance_of Herb::Location, element.location
      assert_instance_of Herb::Location, element.open_tag.tag_name.location
      assert_instance_of Herb::Range, element.open_tag.tag_name.range
      assert_equal true, result.options.track_locations
    end

    test "track_locations false leaves node and token locations nil" do
      result = Herb.parse(SOURCE, track_locations: false)
      element = result.value.children.first

      assert_nil result.value.location
      assert_nil element.location
      assert_nil element.open_tag.tag_name.location
      assert_nil element.open_tag.tag_name.range
      assert_equal false, result.options.track_locations
      assert_parsed_snapshot(SOURCE, track_locations: false)
    end

    test "track_locations false keeps the tree shape intact" do
      with_locations = Herb.parse(SOURCE)
      without_locations = Herb.parse(SOURCE, track_locations: false)

      assert_equal with_locations.value.class, without_locations.value.class
      assert_equal with_locations.value.children.map(&:class), without_locations.value.children.map(&:class)
      assert_equal with_locations.errors.size, without_locations.errors.size
    end

    test "track_locations does not affect lexing" do
      token = Herb.lex(SOURCE).value.first

      assert_instance_of Herb::Location, token.location
      assert_instance_of Herb::Range, token.range
    end

    test "errors keep their locations when track_locations is false" do
      result = Herb.parse("<div>", track_locations: false)

      refute_empty result.errors
      assert_instance_of Herb::Location, result.errors.first.location
    end

    test "unclosed tag errors keep their locations when track_locations is false" do
      source = "<div><span>hello</div>\n"
      result = Herb.parse(source, track_locations: false)
      error = result.errors.first

      assert_instance_of Herb::Errors::MissingClosingTagError, error
      assert_instance_of Herb::Location, error.location
      assert_instance_of Herb::Location, error.opening_tag.location

      assert_parsed_snapshot(source, track_locations: false)
    end

    test "mismatched tag errors keep their locations when track_locations is false" do
      source = "<div>hello</span>\n"

      assert_parsed_snapshot(source, track_locations: false)
    end

    test "error locations are identical whether or not track_locations is enabled" do
      source = "<div><span>hello</div>\n"

      with_locations = Herb.parse(source).errors
      without_locations = Herb.parse(source, track_locations: false).errors

      assert_equal with_locations.map(&:class), without_locations.map(&:class)
      assert_equal with_locations.map { |error| error.location.tree_inspect }, without_locations.map { |error| error.location.tree_inspect }
      assert_equal with_locations.map(&:message), without_locations.map(&:message)
    end
  end
end
