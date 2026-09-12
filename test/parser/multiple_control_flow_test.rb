# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class MultipleControlFlowTest < Minitest::Spec
    include SnapshotUtils

    test "two blocks in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          list.each do |rows|
            rows.each_with_index do |row, row_index| %>
            <% snip %>
          <% end %>
        <% end %>
      ERB
    end

    test "two if blocks in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% if true; if true %>
          <p>content</p>
        <% end; end %>
      ERB
    end

    test "block and case in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.each do |item| case item.type %>
          <% when :a %>a<% when :b %>b<% end; end %>
      ERB
    end

    test "while and if in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% while running; if condition %>
          <span>processing</span>
        <% end; end %>
      ERB
    end

    test "closed blocks in same ERB tag should not error" do
      assert_parsed_snapshot(<<~ERB)
        <% if true; if true; puts "hello"; end; end; %>
      ERB
    end

    test "single block does not trigger error" do
      assert_parsed_snapshot(<<~ERB)
        <% list.each do |item| %>
          <%= item %>
        <% end %>
      ERB
    end

    test "until and if in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% until done; if ready %>
          <span>waiting</span>
        <% end; end %>
      ERB
    end

    test "for and block in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% for i in items; items.each do |item| %>
          <%= item %>
        <% end; end %>
      ERB
    end

    test "begin and if in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% begin; if condition %>
          <p>content</p>
        <% end; end %>
      ERB
    end

    test "unless and block in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% unless skip; items.each do |item| %>
          <%= item %>
        <% end; end %>
      ERB
    end

    test "case and block in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% case type; items.each do |item| %>
          <% when :a %>a
        <% end; end %>
      ERB
    end

    test "three unclosed blocks in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% if a; if b; if c %>
          <p>nested</p>
        <% end; end; end %>
      ERB
    end

    test "block with brace and do in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.map { |x| x.each do |y| %>
          <%= y %>
        <% end } %>
      ERB
    end

    test "two blocks closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.each do |item|; item.parts.each do |part|; puts part; end; end %>
      ERB
    end

    test "block and if closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.each do |item|; if item.valid?; puts item; end; end %>
      ERB
    end

    test "while and if closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% while running; if ready; process; end; end %>
      ERB
    end

    test "until and for closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% until done; for i in items; process(i); end; end %>
      ERB
    end

    test "case with when closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% case type; when :a; puts "a"; when :b; puts "b"; end %>
      ERB
    end

    test "begin with rescue closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% begin; risky_operation; rescue => e; handle(e); end %>
      ERB
    end

    test "unless and if closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% unless skip; if ready; process; end; end %>
      ERB
    end

    test "three blocks closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% if a; if b; if c; puts "deep"; end; end; end %>
      ERB
    end

    test "nested case inside block closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.each do |item|; case item.type; when :a; puts "a"; end; end %>
      ERB
    end

    test "begin with ensure closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% begin; do_work; ensure; cleanup; end %>
      ERB
    end

    test "block with brace closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% items.map { |x| x * 2 }; other.each { |y| puts y } %>
      ERB
    end

    test "postfix if does not trigger error" do
      assert_parsed_snapshot(<<~ERB)
        <% puts "hello" if condition %>
      ERB
    end

    test "postfix unless does not trigger error" do
      assert_parsed_snapshot(<<~ERB)
        <% puts "hello" unless skip %>
      ERB
    end

    test "ternary does not trigger error" do
      assert_parsed_snapshot(<<~ERB)
        <%= condition ? "yes" : "no" %>
      ERB
    end

    test "multi-line nested blocks closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          list.each do |rows|
            rows.each_with_index do |row, row_index|

            end
          end
        %>
      ERB
    end

    test "multi-line if with block closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          if condition
            items.each do |item|
              process(item)
            end
          end
        %>
      ERB
    end

    test "multi-line unless with block closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          unless skip
            items.each do |item|
              process(item)
            end
          end
        %>
      ERB
    end

    test "multi-line case closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          case type
          when :a
            handle_a
          when :b
            handle_b
          else
            handle_default
          end
        %>
      ERB
    end

    test "multi-line while closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          while running
            process
            check_condition
          end
        %>
      ERB
    end

    test "multi-line until closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          until done
            process
            increment
          end
        %>
      ERB
    end

    test "multi-line for closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          for item in items
            process(item)
          end
        %>
      ERB
    end

    test "multi-line begin rescue closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          begin
            risky_operation
          rescue StandardError => e
            handle_error(e)
          end
        %>
      ERB
    end

    test "multi-line begin rescue ensure closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          begin
            risky_operation
          rescue StandardError => e
            handle_error(e)
          ensure
            cleanup
          end
        %>
      ERB
    end

    test "multi-line begin rescue else ensure closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          begin
            risky_operation
          rescue StandardError => e
            handle_error(e)
          else
            success
          ensure
            cleanup
          end
        %>
      ERB
    end

    test "multi-line nested if elsif else closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          if condition_a
            handle_a
          elsif condition_b
            handle_b
          else
            handle_default
          end
        %>
      ERB
    end

    test "multi-line deeply nested blocks closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          if condition
            items.each do |item|
              case item.type
              when :a
                process_a(item)
              when :b
                process_b(item)
              end
            end
          end
        %>
      ERB
    end

    test "multi-line block with brace closed in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <%
          items.map { |item|
            item.transform
          }.each { |result|
            output(result)
          }
        %>
      ERB
    end

    test "case and when in same ERB tag" do
      template = <<~ERB
        <% case variable when "a" %>
          A
        <% when "b" %>
          B
        <% end %>
      ERB

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "case in pattern in same ERB tag" do
      template = <<~ERB
        <% case value in 1 %>
          One
        <% in 2 %>
          Two
        <% end %>
      ERB

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "case and when on newline in same ERB tag" do
      template = <<~ERB
        <% case variable
           when "a" %>
          A
        <% when "b" %>
          B
        <% end %>
      ERB

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "case in pattern on newline in same ERB tag" do
      template = <<~ERB
        <% case value
           in 1 %>
          One
        <% in 2 %>
          Two
        <% end %>
      ERB

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end
    test "case and when in same ERB tag splits the tag content across both nodes" do
      result = Herb.parse(<<~ERB)
        <% case variable when "a" %>
          A
        <% end %>
      ERB

      case_node = result.value.children.first

      assert_equal " case variable ", case_node.content.value
      assert_nil case_node.tag_closing

      condition = case_node.conditions.first

      assert_nil condition.tag_opening
      assert_equal "when \"a\" ", condition.content.value
      assert_equal "%>", condition.tag_closing.value
    end

    test "case and when in same ERB tag keeps the split halves adjacent" do
      result = Herb.parse(<<~ERB)
        <% case variable
           when "a" %>
          A
        <% end %>
      ERB

      case_node = result.value.children.first
      condition = case_node.conditions.first

      assert_equal case_node.content.location.end.line, condition.content.location.start.line
      assert_equal case_node.content.location.end.column, condition.content.location.start.column
    end

    test "case and when in same ERB tag keeps the then keyword on the condition" do
      result = Herb.parse(<<~ERB)
        <% case variable when "a" then %>
          A
        <% end %>
      ERB

      condition = result.value.children.first.conditions.first

      assert_equal "when \"a\" then ", condition.content.value
      refute_nil condition.then_keyword
    end

    test "case in pattern in same ERB tag splits the tag content across both nodes" do
      result = Herb.parse(<<~ERB)
        <% case value in 1 %>
          One
        <% end %>
      ERB

      case_node = result.value.children.first

      assert_equal " case value ", case_node.content.value
      assert_nil case_node.tag_closing

      condition = case_node.conditions.first

      assert_nil condition.tag_opening
      assert_equal "in 1 ", condition.content.value
      assert_equal "%>", condition.tag_closing.value
    end

    test "case and when in separate ERB tags keeps both tags intact" do
      result = Herb.parse(<<~ERB)
        <% case variable %>
        <% when "a" %>
          A
        <% end %>
      ERB

      case_node = result.value.children.first

      assert_equal "%>", case_node.tag_closing.value

      condition = case_node.conditions.first

      assert_equal "<%", condition.tag_opening.value
      assert_equal "%>", condition.tag_closing.value
    end
    test "else and end in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% if a %>
          x
        <%
        else
          y
        end
        %>
      ERB
    end

    test "elsif and end in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% if a %>
          x
        <% elsif b
          y
        end %>
      ERB
    end

    test "when and end in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% case t %>
        <% when 1
          a
        end %>
      ERB
    end

    test "rescue and end in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% begin %>
          x
        <% rescue
          y
        end %>
      ERB
    end

    test "ensure and end in same ERB tag" do
      assert_parsed_snapshot(<<~ERB)
        <% begin %>
          x
        <% ensure
          y
        end %>
      ERB
    end

    test "else and end in same ERB tag splits the tag across both nodes" do
      result = Herb.parse(<<~ERB)
        <% if a %>
          x
        <% else
          y
        end %>
      ERB

      if_node = result.value.children.first
      else_node = if_node.subsequent

      assert_equal "<%", else_node.tag_opening.value
      assert_equal " else\n  y\n", else_node.content.value
      assert_nil else_node.tag_closing

      end_node = if_node.end_node

      assert_nil end_node.tag_opening
      assert_equal "end ", end_node.content.value
      assert_equal "%>", end_node.tag_closing.value
    end

    test "when and end in same ERB tag keeps the condition" do
      result = Herb.parse(<<~ERB)
        <% case t %>
        <% when 1
          a
        end %>
      ERB

      case_node = result.value.children.first

      assert_equal 1, case_node.conditions.size
      refute_nil case_node.end_node
    end

    test "else and end in same ERB tag closes the block" do
      result = Herb.parse(<<~ERB)
        <% if a %>
          x
        <% else
          y
        end %>
      ERB

      assert_empty result.value.recursive_errors.reject { |error| error.is_a?(Herb::Errors::RubyParseError) }
    end

    test "two end keywords in same ERB tag stay one end node" do
      result = Herb.parse(<<~ERB)
        <% if true; if true %>
          <p>content</p>
        <% end; end %>
      ERB

      if_node = result.value.children.first

      assert_equal " end; end ", if_node.end_node.content.value
      assert_equal "%>", if_node.end_node.tag_closing.value
    end
  end
end
