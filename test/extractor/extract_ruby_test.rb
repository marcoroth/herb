# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractRubyTest < Minitest::Spec
    test "basic silent" do
      ruby = Herb.extract_ruby("<h1><% RUBY_VERSION %></h1>")

      assert_equal "       RUBY_VERSION  ;     ", ruby
    end

    test "basic loud" do
      ruby = Herb.extract_ruby("<h1><%= RUBY_VERSION %></h1>")

      assert_equal "        RUBY_VERSION  ;     ", ruby
    end

    test "with newlines" do
      actual = Herb.extract_ruby(<<~HTML)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "    \n     RUBY_VERSION  ;\n     \n", actual
    end

    test "nested" do
      actual = Herb.extract_ruby(<<~HTML)
        <% array = [1, 2, 3] %>

        <ul>
          <% array.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      HTML

      expected = "   array = [1, 2, 3]  ;\n\n    \n     array.each do |item|  ;\n            item  ;     \n     end  ;\n     \n"

      assert_equal expected, actual
    end

    test "erb comment" do
      actual = Herb.extract_ruby(<<~HTML)
        <%# comment ' %>
      HTML

      expected = "                \n"

      assert_equal expected, actual
    end

    test "erb comment with ruby keyword" do
      actual = Herb.extract_ruby(<<~HTML)
        <%# end %>
      HTML

      expected = "          \n"

      assert_equal expected, actual
    end

    test "erb comment broken up over multiple lines" do
      actual = Herb.extract_ruby(<<~HTML)
        <%#
          end
        %>
      HTML

      expected = "            \n"

      # TODO: it should also preserve the newlines in the ERB content
      # expected = "\n  #\n  end\n  "

      assert_equal expected, actual
    end

    test "multi-line erb comment" do
      actual = Herb.extract_ruby(<<~HTML)
        <%#
          end
          end
          end
          end
        %>
      HTML

      expected = "                              \n"

      # TODO: it should also preserve the newlines in the ERB content
      # expected = "   \n     \n      \n     \n     \n  \n"

      assert_equal expected, actual
    end

    test "erb if/end and comment on same line" do
      actual = Herb.extract_ruby(<<~HTML)
        <% if %><%# comment %><% end %>
      HTML

      expected = "   if  ;                 end  ;\n"

      assert_equal expected, actual
    end

    xtest "erb if/end and Ruby comment on same line" do
      actual = Herb.extract_ruby(<<~HTML)
        <% if %><% # comment %><% end %>
      HTML

      expected = "   if  ;   # comment  ;   end  ;\n"

      assert_equal expected, actual
    end
  end
end
