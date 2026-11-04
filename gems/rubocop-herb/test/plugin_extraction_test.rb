# frozen_string_literal: true

require_relative "test_helper"

module RuboCop
  module Herb
    class PluginExtractionTest < Minitest::Spec
      test "builds one character-aligned Ruby source" do
        template = "<p>Café <%= x=1 %></p>\n"
        fragment = extract(template).first
        source = fragment[:processed_source].raw_source

        assert_equal 0, fragment[:offset]
        assert_equal template.length, source.length
        assert_equal "x=1", source[template.index("x=1"), 3]
        assert fragment[:processed_source].valid_syntax?
      end

      test "keeps lines aligned after multi-line escaped ERB" do
        template = "<%% a\nb %%>\n<p>Ünï</p><%= x %>\n"
        source = extract(template).first[:processed_source].raw_source

        assert_equal template.length, source.length
        assert_equal template.index("x"), source.index("x")
        assert_equal template.count("\n"), source.count("\n")
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

      test "preserves multibyte characters in Ruby" do
        source = extract("<%= name == \"José\" %>\n").first[:processed_source]

        assert_includes source.raw_source, "name == \"José\""
      end

      test "records the Ruby of each tag without surrounding whitespace" do
        template = "<p>Café</p> <%= a  + b %>\n<% if c %>\n<%# note %>\n"
        source = extract(template).first[:processed_source]

        assert_equal(["a  + b", "if c"], source.ruby_ranges.map { |range| template[range] })
      end

      test "skips comments and escaped ERB" do
        fragments = extract(<<~ERB)
          <%# x=1 %>
          <%% x=1 %%>
        ERB

        assert_empty fragments
      end

      test "returns nil for non-template files" do
        assert_nil Plugin.extract_ruby(processed_source("x=1\n", "example.rb"))
      end

      test "extracts Ruby from every template extension" do
        ["example.rss.erb", "example.erb", "example.herb"].each do |path|
          refute_empty Plugin.extract_ruby(processed_source("<%= x=1 %>\n", path))
        end
      end

      private

      def extract(source)
        Plugin.extract_ruby(processed_source(source, "example.html.erb"))
      end

      def processed_source(source, path)
        ::RuboCop::ProcessedSource.new(source, 3.2, path)
      end
    end
  end
end
