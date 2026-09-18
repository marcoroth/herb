# frozen_string_literal: true

require_relative "test_helper"

module RuboCop
  module Herb
    class RubyExtractorTest < Minitest::Spec
      test "builds one position-preserving Ruby source" do
        template = "<p>Café <%= x=1 %></p>\n"
        fragment = extract(template).first
        source = fragment[:processed_source].raw_source

        assert_equal 0, fragment[:offset]
        assert_equal template.length, source.length
        assert_equal "x=1", source[template.index("x=1"), 3]
        assert fragment[:processed_source].valid_syntax?
      end

      test "preserves Ruby control flow across ERB tags" do
        fragment = extract(<<~ERB).first
          <% case status %>
          <% when "open", "closed" %>
            <% if user.admin? %>
              <%= users.each do |user| %>
                <%= user.name %>
              <% end %>
            <% end %>
          <% end %>
        ERB

        source = fragment[:processed_source]

        assert source.valid_syntax?
        assert_equal :case, source.ast.type
        assert_includes source.raw_source, "when \"open\", \"closed\""
        assert_includes source.raw_source, "users.each do |user|"
      end

      test "separates adjacent Ruby tags on the same line" do
        source = extract("<%= first %><%= second %>\n").first[:processed_source]

        assert source.valid_syntax?
        assert_equal 2, source.ast.each_node(:send).count
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

      test "does not extract Ruby from non-HTML ERB files" do
        assert_empty RubyExtractor.call(processed_source("<%= x=1 %>\n", "example.rss.erb"))
        assert_empty RubyExtractor.call(processed_source("<%= x=1 %>\n", "example.erb"))
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
