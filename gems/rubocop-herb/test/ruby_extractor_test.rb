# frozen_string_literal: true

require_relative "test_helper"

module RuboCop
  module Herb
    class RubyExtractorTest < Minitest::Spec
      test "extracts Ruby fragments with template offsets" do
        fragments = extract("<p>Café <%= x=1 %></p>\n")

        assert_equal 1, fragments.length
        assert_equal " x=1 ", fragments.first[:processed_source].raw_source
        assert_equal 11, fragments.first[:offset]
      end

      test "normalizes control-flow fragments" do
        fragments = extract(<<~ERB)
          <% if user.admin? %>
            <%= users.each do |user| %>
              <%= user.name %>
            <% end %>
          <% end %>
        ERB

        sources = fragments.map { |fragment| fragment[:processed_source].raw_source }

        assert_equal ["user.admin? ", " users.each", " user.name "], sources
      end

      test "decomposes when conditions" do
        fragments = extract("<% when \"open\", \"closed\" %>\n")

        sources = fragments.map { |fragment| fragment[:processed_source].raw_source }

        assert_equal ["\"open\"", "\"closed\""], sources
      end

      test "uses Ruby tokens when removing block syntax" do
        fragments = extract(<<~ERB)
          <%= users.each do |(user, index), *rest; local| %>
            <%= "do" %>
          <% end %>
        ERB

        sources = fragments.map { |fragment| fragment[:processed_source].raw_source }

        assert_equal [" users.each", " \"do\" "], sources
      end

      test "does not treat keywords inside when expressions as syntax" do
        fragments = extract("<% when \"then\", method(:do) then %>\n")
        sources = fragments.map { |fragment| fragment[:processed_source].raw_source }

        assert_equal ["\"then\"", "method(:do)"], sources
      end

      test "skips comments, escaped ERB, and GraphQL tags" do
        fragments = extract(<<~ERB)
          <%# x=1 %>
          <%% x=1 %%>
          <%graphql query Example { viewer { login } } %>
        ERB

        assert_empty fragments
      end

      test "returns nil for non-ERB files" do
        assert_nil RubyExtractor.call(processed_source("x=1\n", "example.rb"))
      end

      private

      def extract(source)
        RubyExtractor.call(processed_source(source, "example.html.erb"))
      end

      def processed_source(source, path)
        ::RuboCop::ProcessedSource.new(source, 3.2, path)
      end
    end
  end
end
