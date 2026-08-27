# frozen_string_literal: true

require_relative "../test_helper"

module AST
  class HelpersTest < Minitest::Spec
    include Herb::AST::Helpers

    def erb_node(source)
      Herb.parse(source, render_nodes: true).value.children.first
    end

    describe "#erb_output?" do
      test "an output tag writes its value" do
        assert erb_output?("<%=")
        assert erb_output?("<%==")
      end

      test "a statement tag does not" do
        refute erb_output?("<%")
      end

      test "a commented-out output tag is a comment, not an output" do
        refute erb_output?("<%#=")
        refute erb_output?("<%#")
      end
    end

    describe "#erb_node?" do
      test "recognizes a content tag" do
        assert erb_node?(erb_node("<% total = 1 %>"))
      end

      test "recognizes a render tag" do
        node = erb_node(%(<%= render "posts/card" %>))

        assert_instance_of Herb::AST::ERBRenderNode, node
        assert erb_node?(node)
      end

      test "rejects anything that is not an ERB tag" do
        refute erb_node?(erb_node("<div>hi</div>"))
        refute erb_node?(nil)
      end
    end

    describe "#erb_outputs? and #erb_statement?" do
      test "tells an output tag from a statement" do
        output = erb_node("<%= total %>")
        statement = erb_node("<% total = 1 %>")

        assert erb_outputs?(output)
        refute erb_statement?(output)

        assert erb_statement?(statement)
        refute erb_outputs?(statement)
      end

      test "calls a render tag an output" do
        assert erb_outputs?(erb_node(%(<%= render "posts/card" %>)))
      end

      test "calls a comment neither" do
        comment = erb_node("<%# nothing %>")

        refute erb_outputs?(comment)
        refute erb_statement?(comment)
      end

      test "calls a block that writes its value an output" do
        block = erb_node("<%= form_with do %>x<% end %>")

        assert_instance_of Herb::AST::ERBBlockNode, block
        assert erb_outputs?(block)
        refute erb_statement?(block)
      end

      test "calls a block that writes nothing a statement" do
        block = erb_node("<% items.each do |item| %>x<% end %>")

        assert_instance_of Herb::AST::ERBBlockNode, block
        assert erb_statement?(block)
        refute erb_outputs?(block)
      end

      test "reads the opening of an iteration block the parser told apart" do
        block = Herb.parse("<% items.each do |item| %>x<% end %>", iteration_nodes: true).value.children.first

        assert_instance_of Herb::AST::ERBIterationBlockNode, block
        assert_equal "<%", erb_opening(block)
        assert erb_statement?(block)
      end

      test "leaves control flow and terminators out, since their openings carry no expression" do
        source = "<% if a %>x<% else %>y<% end %>"
        conditional = Herb.parse(source).value.children.first

        assert_instance_of Herb::AST::ERBIfNode, conditional
        assert_empty erb_opening(conditional)
        refute erb_node?(conditional)
        refute erb_outputs?(conditional)
        refute erb_statement?(conditional)
      end
    end
  end
end
