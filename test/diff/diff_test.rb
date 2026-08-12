# frozen_string_literal: true

require_relative "../test_helper"

module Diff
  class DiffTest < Minitest::Spec
    test "returns a DiffResult" do
      result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert_kind_of Herb::DiffResult, result
    end

    test "operations returns DiffOperation instances" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_kind_of Herb::DiffOperation, result.operations[0]
    end

    test "identical documents" do
      result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert result.identical?
      refute result.changed?
      assert_equal 0, result.operation_count
    end

    test "text changed" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      refute result.identical?
      assert result.changed?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.operations[0].type
    end

    test "attribute value changed" do
      result = Herb.diff('<div class="old">Hi</div>', '<div class="new">Hi</div>')

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_value_changed, result.operations[0].type
    end

    test "attribute added" do
      result = Herb.diff("<div>Hi</div>", '<div class="new">Hi</div>')

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_added, result.operations[0].type
    end

    test "attribute removed" do
      result = Herb.diff('<div class="old">Hi</div>', "<div>Hi</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_removed, result.operations[0].type
    end

    test "node inserted" do
      result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_inserted, result.operations[0].type
    end

    test "node removed" do
      result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_removed, result.operations[0].type
    end

    test "erb content changed" do
      result = Herb.diff("<%= foo %>", "<%= bar %>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :erb_content_changed, result.operations[0].type
    end

    test "node moved with distinguishing attributes" do
      result = Herb.diff(
        '<ul><li class="a">A</li><li class="b">B</li></ul>',
        '<ul><li class="b">B</li><li class="a">A</li></ul>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
    end

    test "plain reorder without attributes reports text changes not moves" do
      result = Herb.diff(
        "<ul><li>A</li><li>B</li></ul>",
        "<ul><li>B</li><li>A</li></ul>"
      )

      refute result.identical?

      types = result.operations.map(&:type)

      refute_includes types, :node_moved
      assert_includes types, :text_changed
    end

    test "move with attribute value change" do
      result = Herb.diff(
        '<div id="x" class="old">A</div><div id="y">B</div>',
        '<div id="y">B</div><div id="x" class="new">A</div>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
      assert_includes types, :attribute_value_changed
    end

    test "move with content change" do
      result = Herb.diff(
        '<div id="a">Old</div><div id="b">B</div>',
        '<div id="b">B</div><div id="a">New</div>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
      assert_includes types, :text_changed
    end

    test "multiple changes with unchanged subtree" do
      result = Herb.diff(
        '<div class="old"><span>Hello</span><p>Keep</p></div>',
        '<div class="new"><span>World</span><p>Keep</p></div>'
      )

      refute result.identical?
      assert_equal 2, result.operation_count

      types = result.operations.map(&:type)

      assert_includes types, :attribute_value_changed
      assert_includes types, :text_changed
    end

    test "operations have path" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      operation = result.operations[0]

      assert_kind_of Array, operation.path
      refute_empty operation.path
    end

    test "operations have old and new nodes" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      operation = result.operations[0]

      assert_kind_of Herb::AST::HTMLTextNode, operation.old_node
      assert_kind_of Herb::AST::HTMLTextNode, operation.new_node
    end

    test "inserted operation has nil old node" do
      result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      operation = result.operations[0]

      assert_nil operation.old_node
      refute_nil operation.new_node
    end

    test "removed operation has nil new node" do
      result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      operation = result.operations[0]

      refute_nil operation.old_node
      assert_nil operation.new_node
    end

    test "complex erb diff" do
      old_source = <<~ERB
        <div class="container">
          <% if current_user %>
            <p>Hello, <%= current_user.name %></p>
          <% end %>
        </div>
      ERB

      new_source = <<~ERB
        <div class="wrapper">
          <% if current_user %>
            <p>Hello, <%= current_user.email %></p>
          <% end %>
        </div>
      ERB

      result = Herb.diff(old_source, new_source)

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :attribute_value_changed
      assert_includes types, :erb_content_changed
    end

    test "wrap with ERB conditional" do
      result = Herb.diff("<div>Content</div>", "<% if condition? %><div>Content</div><% end %>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.operations[0].type
    end

    test "unwrap from ERB conditional" do
      result = Herb.diff("<% if condition? %><div>Content</div><% end %>", "<div>Content</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.operations[0].type
    end

    test "wrap with HTML element" do
      result = Herb.diff("<div>Hello</div>", "<h1><div>Hello</div></h1>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.operations[0].type
    end

    test "unwrap from HTML element" do
      result = Herb.diff("<section><p>Text</p></section>", "<p>Text</p>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.operations[0].type
    end

    test "wrap with content change is not detected as wrap" do
      result = Herb.diff("<div>Old</div>", "<% if x %><div>New</div><% end %>")

      refute result.identical?

      types = result.operations.map(&:type)

      refute_includes types, :node_wrapped
    end

    test "wrapped operation has old and new nodes" do
      result = Herb.diff("<div>Content</div>", "<% if condition? %><div>Content</div><% end %>")

      operation = result.operations[0]

      assert_kind_of Herb::AST::HTMLElementNode, operation.old_node
      assert_kind_of Herb::AST::ERBIfNode, operation.new_node
    end

    test "to_hash serialization" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      hash = result.to_hash

      assert_kind_of Hash, hash
      assert_equal false, hash[:identical]
      assert_kind_of Array, hash[:operations]
      assert_equal :text_changed, hash[:operations][0][:type]
    end

    test "inspect output" do
      identical_result = Herb.diff("<div>Same</div>", "<div>Same</div>")
      assert_match(/identical/, identical_result.inspect)

      changed_result = Herb.diff("<div>Hello</div>", "<div>World</div>")
      assert_match(/1 operation/, changed_result.inspect)
    end

    test "DiffResult is Enumerable" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_kind_of Enumerable, result

      types = result.map(&:type)
      assert_includes types, :text_changed
    end

    test "DiffResult#each yields operations" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      count = 0
      result.each { count += 1 }

      assert_equal result.operations.size, count
    end

    test "DiffResult#each returns enumerator without block" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      enumerator = result.each
      assert_kind_of Enumerator, enumerator
    end

    test "DiffOperation equality" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      op = result.operations[0]

      assert_equal op.type, :text_changed
      assert_kind_of Array, op.path
      assert_equal op, op
    end

    test "DiffOperation is frozen" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_predicate result.operations[0], :frozen?
    end

    test "DiffResult is frozen" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_predicate result, :frozen?
    end

    test "DiffOperation is a Data class" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_kind_of Data, result.operations[0]
    end

    test "empty documents are identical" do
      result = Herb.diff("", "")

      assert_predicate result, :identical?
      assert_equal 0, result.operation_count
    end

    test "different top-level elements are removed and inserted" do
      result = Herb.diff("<div>Hello</div>", "<span>Hello</span>")

      refute result.identical?

      types = result.map(&:type)
      assert_includes types, :node_removed
      assert_includes types, :node_inserted
    end

    test "multiple moves with distinguishing attributes" do
      result = Herb.diff(
        '<ul><li id="a">A</li><li id="b">B</li><li id="c">C</li><li id="d">D</li></ul>',
        '<ul><li id="d">D</li><li id="c">C</li><li id="b">B</li><li id="a">A</li></ul>'
      )

      refute result.identical?

      move_ops = result.select { |op| op.type == :node_moved }
      assert_operator move_ops.size, :>=, 2
    end

    test "move preserves correct indices" do
      result = Herb.diff(
        '<ul><li id="first">1</li><li id="second">2</li></ul>',
        '<ul><li id="second">2</li><li id="first">1</li></ul>'
      )

      refute result.identical?

      move_ops = result.select { |op| op.type == :node_moved }
      assert_equal 1, move_ops.size

      move = move_ops[0]
      refute_equal move.old_index, move.new_index
    end

    test "move among other changes" do
      result = Herb.diff(
        '<div id="keep">Keep</div><div id="remove">Remove</div>',
        '<div>New</div><div id="keep">Keep</div>'
      )

      refute result.identical?

      types = result.map(&:type)
      assert_includes types, :node_moved
      assert_operator result.operation_count, :>=, 2
    end

    test "many siblings with single move" do
      old_items = (1..10).map { |i| %(<li id="item#{i}">Item #{i}</li>) }.join
      new_items = (1..10).map { |i|
        index = if i == 1
                  10
                else
                  (i == 10 ? 1 : i)
                end

        %(<li id="item#{index}">Item #{index}</li>)
      }.join

      result = Herb.diff("<ul>#{old_items}</ul>", "<ul>#{new_items}</ul>")

      refute result.identical?

      move_ops = result.select { |op| op.type == :node_moved }
      assert_operator move_ops.size, :>=, 1
    end

    test "coalesced keep detects tag identity match with attribute changes" do
      result = Herb.diff(
        '<div id="x" class="old">Content</div><div id="y">Other</div>',
        '<div id="y">Other</div><div id="x" class="new">Content</div>'
      )

      refute result.identical?

      types = result.map(&:type)
      assert_includes types, :node_moved
      assert_includes types, :attribute_value_changed
    end

    test "wrap detection with multiple candidates" do
      result = Herb.diff(
        "<p>A</p><p>B</p>",
        "<div><p>A</p></div><p>B</p>"
      )

      refute result.identical?

      types = result.map(&:type)
      assert_includes types, :node_wrapped
    end

    test "unwrap detection with multiple candidates" do
      result = Herb.diff(
        "<div><p>A</p></div><p>B</p>",
        "<p>A</p><p>B</p>"
      )

      refute result.identical?

      types = result.map(&:type)
      assert_includes types, :node_unwrapped
    end

    test "move does not match nodes without attributes" do
      result = Herb.diff(
        "<ul><li>A</li><li>B</li><li>C</li></ul>",
        "<ul><li>C</li><li>A</li><li>B</li></ul>"
      )

      refute result.identical?

      types = result.map(&:type)
      refute_includes types, :node_moved
    end

    test "simultaneous moves and unchanged nodes" do
      result = Herb.diff(
        '<div id="a">A</div><div id="static">S</div><div id="b">B</div>',
        '<div id="b">B</div><div id="static">S</div><div id="a">A</div>'
      )

      refute result.identical?

      move_ops = result.select { |op| op.type == :node_moved }
      assert_operator move_ops.size, :>=, 1
    end

    test "wrap in ERB block" do
      result = Herb.diff(
        "<p>Content</p>",
        "<% items.each do |item| %><p>Content</p><% end %>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.first.type
      assert_kind_of Herb::AST::HTMLElementNode, result.first.old_node
      assert_kind_of Herb::AST::ERBBlockNode, result.first.new_node
    end

    test "unwrap from ERB block" do
      result = Herb.diff(
        "<% items.each do |item| %><p>Content</p><% end %>",
        "<p>Content</p>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.first.type
      assert_kind_of Herb::AST::ERBBlockNode, result.first.old_node
      assert_kind_of Herb::AST::HTMLElementNode, result.first.new_node
    end

    test "wrap in ERB unless" do
      result = Herb.diff(
        "<div>Content</div>",
        "<% unless hidden? %><div>Content</div><% end %>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.first.type
      assert_kind_of Herb::AST::ERBUnlessNode, result.first.new_node
    end

    test "unwrap from ERB unless" do
      result = Herb.diff(
        "<% unless hidden? %><div>Content</div><% end %>",
        "<div>Content</div>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.first.type
      assert_kind_of Herb::AST::ERBUnlessNode, result.first.old_node
    end

    test "wrap text in HTML element" do
      result = Herb.diff(
        "<div>hello</div>",
        "<div><div>hello</div></div>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.first.type
      assert_kind_of Herb::AST::HTMLTextNode, result.first.old_node
      assert_kind_of Herb::AST::HTMLElementNode, result.first.new_node
    end

    test "unwrap text from HTML element" do
      result = Herb.diff(
        "<div><span>hello</span></div>",
        "<div>hello</div>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.first.type
      assert_kind_of Herb::AST::HTMLElementNode, result.first.old_node
      assert_kind_of Herb::AST::HTMLTextNode, result.first.new_node
    end

    test "growing a whitespace run in text" do
      result = Herb.diff("<div>Hello World</div>", "<div>Hello     World</div>")

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "shrinking a whitespace run in text" do
      result = Herb.diff("<div>Hello     World</div>", "<div>Hello World</div>")

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "changing which whitespace characters a run is made of" do
      result = Herb.diff("<div>Hello\n\tWorld</div>", "<div>Hello World</div>")

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "removing the last whitespace of a run in text" do
      result = Herb.diff("<div>Hello World</div>", "<div>HelloWorld</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "adding leading whitespace to text" do
      result = Herb.diff("<div>Hello</div>", "<div> Hello</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "adding trailing whitespace to text" do
      result = Herb.diff("<div>Hello</div>", "<div>Hello </div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing the indentation of a nested element" do
      result = Herb.diff(
        "<div>\n  <span>Hello</span>\n</div>",
        "<div>\n      <span>Hello</span>\n</div>"
      )

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "removing the whitespace around a nested element" do
      result = Herb.diff(
        "<div>\n  <span>Hello</span>\n</div>",
        "<div><span>Hello</span></div>"
      )

      refute result.identical?
      assert_equal 2, result.operation_count
      assert_equal [:node_removed, :node_removed], result.operations.map(&:type)
    end

    test "changing a whitespace run inside a pre element" do
      result = Herb.diff("<pre>Hello World</pre>", "<pre>Hello     World</pre>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing a whitespace run inside a textarea element" do
      result = Herb.diff("<textarea>Hello World</textarea>", "<textarea>Hello     World</textarea>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing a whitespace run nested inside a pre element" do
      result = Herb.diff(
        "<pre><code>Hello World</code></pre>",
        "<pre><code>Hello     World</code></pre>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing a whitespace run inside an ERB block inside a pre element" do
      result = Herb.diff(
        "<pre><% if condition %>Hello World<% end %></pre>",
        "<pre><% if condition %>Hello     World<% end %></pre>"
      )

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing a whitespace run inside an ERB block outside a pre element" do
      result = Herb.diff(
        "<div><% if condition %>Hello World<% end %></div>",
        "<div><% if condition %>Hello     World<% end %></div>"
      )

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "changing a whitespace run inside an uppercase PRE element" do
      result = Herb.diff("<PRE>Hello World</PRE>", "<PRE>Hello     World</PRE>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "changing a whitespace run in an attribute value" do
      result = Herb.diff('<div title="Hello World">Hi</div>', '<div title="Hello     World">Hi</div>')

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_value_changed, result.first.type
    end

    test "changing a whitespace run in ERB content" do
      result = Herb.diff("<%= user.name %>", "<%= user.name     %>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :erb_content_changed, result.first.type
    end

    test "changing a whitespace run next to a real text change" do
      result = Herb.diff("<div>Hello World</div>", "<div>Goodbye     World</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.first.type
    end

    test "track_whitespace_changes reports a whitespace_changed operation" do
      result = Herb.diff("<div>Hello World</div>", "<div>Hello     World</div>", track_whitespace_changes: true)

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :whitespace_changed, result.first.type
      assert_kind_of Herb::AST::HTMLTextNode, result.first.old_node
      assert_kind_of Herb::AST::HTMLTextNode, result.first.new_node
    end

    test "track_whitespace_changes accepts a string key" do
      result = Herb.diff("<div>Hello World</div>", "<div>Hello     World</div>", "track_whitespace_changes" => true)

      assert_equal [:whitespace_changed], result.operations.map(&:type)
    end

    test "track_whitespace_changes reports changed indentation" do
      result = Herb.diff(
        "<div>\n  <span>Hello</span>\n</div>",
        "<div>\n      <span>Hello</span>\n</div>",
        track_whitespace_changes: true
      )

      assert_equal [:whitespace_changed], result.operations.map(&:type)
    end

    test "track_whitespace_changes leaves identical documents identical" do
      result = Herb.diff("<div>Hello World</div>", "<div>Hello World</div>", track_whitespace_changes: true)

      assert result.identical?
      assert_equal 0, result.operation_count
    end

    test "track_whitespace_changes still reports significant changes as text_changed" do
      result = Herb.diff("<div>Hello World</div>", "<div>HelloWorld</div>", track_whitespace_changes: true)

      assert_equal [:text_changed], result.operations.map(&:type)
    end

    test "track_whitespace_changes still reports pre content as text_changed" do
      result = Herb.diff("<pre>Hello World</pre>", "<pre>Hello     World</pre>", track_whitespace_changes: true)

      assert_equal [:text_changed], result.operations.map(&:type)
    end

    test "track_whitespace_changes defaults to off" do
      result = Herb.diff("<div>Hello World</div>", "<div>Hello     World</div>", track_whitespace_changes: false)

      assert result.identical?
      assert_equal 0, result.operation_count
    end
  end
end
