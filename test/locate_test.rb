# frozen_string_literal: true

require_relative "test_helper"

class LocateTest < Minitest::Spec
  def locate(source, line, column)
    Herb.parse(source).value.locate(Herb::Position.from(line, column))
  end

  def types(nodes)
    nodes.map { |node| node.class.name.split("::").last }
  end

  describe "what it finds" do
    test "the innermost node at a position" do
      result = locate("<div>hello</div>", 1, 7)

      assert_equal "HTMLTextNode", types([result.node]).first
    end

    test "an open tag when the position is on the tag name" do
      result = locate("<div>hello</div>", 1, 2)

      assert_equal "HTMLOpenTagNode", types([result.node]).first
    end

    test "the literal inside an attribute name, with the name node above it" do
      result = locate(%(<div class="card">x</div>), 1, 7)

      assert_equal "LiteralNode", types([result.node]).first
      assert_equal "HTMLAttributeNameNode", types([result.innermost(Herb::AST::HTMLAttributeNameNode)]).first
    end

    test "an attribute value" do
      result = locate(%(<div class="card">x</div>), 1, 13)

      assert_equal "LiteralNode", types([result.node]).first
    end

    test "inside an ERB tag" do
      result = locate("<div><%= title %></div>", 1, 10)

      assert_equal "ERBContentNode", types([result.node]).first
    end

    test "the open tag at the very first character of the source" do
      result = locate("<div>x</div>", 1, 0)

      assert_equal "HTMLOpenTagNode", types([result.node]).first
    end
  end

  describe "ancestors" do
    test "read nearest first" do
      result = locate("<div><span>hi</span></div>", 1, 12)

      assert_equal ["HTMLElementNode", "HTMLElementNode", "DocumentNode"], types(result.ancestors)
    end

    test "stop at the node the walk started from" do
      result = locate("x", 1, 0)

      assert_equal ["DocumentNode"], types(result.ancestors)
      assert_equal "HTMLTextNode", types([result.node]).first
    end

    test "are empty when the node the walk started from is the answer" do
      document = Herb.parse("x").value
      text = document.children.first
      result = text.locate(Herb::Position[1, 0])

      assert_equal [], result.ancestors
      assert_same text, result.node
    end

    test "place the position inside every one of them" do
      result = locate("<div><span>hi</span></div>", 1, 12)
      position = Herb::Position[1, 12]

      assert(result.ancestors.all? { |ancestor| ancestor.location.contains?(position) })
    end
  end

  describe "a position outside the source" do
    test "answers with nothing when it is past the end" do
      assert_nil locate("<div>x</div>", 1, 999)
    end

    test "answers with nothing when it is on a line that does not exist" do
      assert_nil locate("<div>x</div>", 99, 0)
    end
  end

  describe "where one node ends and the next begins" do
    test "the character between two siblings belongs to the second" do
      source = "<b>one</b><i>two</i>"

      assert_equal "b", locate(source, 1, 9).innermost(Herb::AST::HTMLElementNode).tag_name.value
      assert_equal "i", locate(source, 1, 10).innermost(Herb::AST::HTMLElementNode).tag_name.value
    end

    test "a node's own start belongs to it" do
      result = locate("<b>one</b>", 1, 0)

      assert_equal "HTMLOpenTagNode", types([result.node]).first
    end
  end

  describe "#innermost" do
    test "answers with the node itself when it is of that kind" do
      result = locate("<div>x</div>", 1, 2)

      assert_same result.node, result.innermost(Herb::AST::HTMLOpenTagNode)
    end

    test "walks up to the nearest ancestor of that kind" do
      result = locate("<div><span>hi</span></div>", 1, 12)

      assert_equal "span", result.innermost(Herb::AST::HTMLElementNode).tag_name.value
    end

    test "answers with nothing when no node is of that kind" do
      result = locate("<div>x</div>", 1, 2)

      assert_nil result.innermost(Herb::AST::ERBContentNode)
    end
  end

  describe "#path" do
    test "reads outermost first and ends with the node that was found" do
      result = locate("<div><span>hi</span></div>", 1, 12)

      assert_equal ["DocumentNode", "HTMLElementNode", "HTMLElementNode", "HTMLTextNode"], types(result.path)
      assert_same result.node, result.path.last
    end
  end

  describe "a node the parser synthesized" do
    test "is stepped over, because a zero location answers for nothing" do
      node = Herb::AST::HTMLTextNode.build(content: +"x")

      assert_predicate node.location, :empty?
      assert_nil node.locate(Herb::Position[0, 0])
    end
  end

  describe "locating from a node other than the document" do
    test "starts the walk at whatever node it is given" do
      document = Herb.parse("<div><span>hi</span></div>").value
      element = document.children.first
      result = element.locate(Herb::Position[1, 12])

      assert_equal ["HTMLElementNode", "HTMLElementNode"], types(result.ancestors)
    end

    test "answers with nothing when the position is outside that node" do
      document = Herb.parse("<b>one</b><i>two</i>").value
      first = document.children.first

      assert_nil first.locate(Herb::Position[1, 15])
    end
  end

  describe "a branch of an if" do
    def branches
      "<% if a %>A<% elsif b %>B<% else %>C<% end %>"
    end

    test "is reachable even though it is positioned after the node that holds it" do
      assert_equal "A", locate(branches, 1, 10).node.content
      assert_equal "B", locate(branches, 1, 24).node.content
      assert_equal "C", locate(branches, 1, 35).node.content
    end

    test "keeps the whole walk in the path" do
      result = locate(branches, 1, 35)

      assert_equal ["DocumentNode", "ERBIfNode", "ERBIfNode", "ERBElseNode", "HTMLTextNode"], types(result.path)
    end

    test "leaves ancestors that do not cover the position for the caller to filter" do
      result = locate(branches, 1, 35)
      position = Herb::Position[1, 35]
      covering = result.ancestors.select { |ancestor| ancestor.location.contains?(position) }

      assert_equal ["ERBElseNode", "ERBIfNode", "DocumentNode"], types(covering)
    end
  end

  describe "a parse result" do
    test "answers for the document it parsed" do
      result = Herb.parse("<div><span>hi</span></div>").locate(Herb::Position[1, 12])

      assert_equal "HTMLTextNode", types([result.node]).first
    end

    test "answers the same way the document it holds does" do
      parsed = Herb.parse("<div><span>hi</span></div>")
      position = Herb::Position[1, 12]

      assert_same parsed.locate(position).node, parsed.value.locate(position).node
    end

    test "says whether a position falls inside it at all" do
      parsed = Herb.parse("<div>x</div>")

      assert parsed.locatable?(Herb::Position[1, 2])
      refute parsed.locatable?(Herb::Position[1, 999])
    end
  end

  describe "#locatable?" do
    test "answers for a position the node covers" do
      assert Herb.parse("<div>x</div>").value.locatable?(Herb::Position[1, 2])
    end

    test "does not answer for a position past the end" do
      refute Herb.parse("<div>x</div>").value.locatable?(Herb::Position[1, 999])
    end

    test "answers for a position only a branch covers" do
      assert Herb.parse("<% if a %>A<% else %>C<% end %>").value.locatable?(Herb::Position[1, 21])
    end
  end
end
