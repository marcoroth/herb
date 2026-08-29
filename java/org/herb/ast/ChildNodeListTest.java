package org.herb.ast;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.herb.Herb;
import org.herb.ParseResult;
import org.junit.jupiter.api.Test;

public class ChildNodeListTest {
  private static final class RecordingVisitor extends Visitor<Void, Void> {
    private final List<String> lists = new ArrayList<>();

    @Override
    protected void visitChildNodeList(ChildNodeList list, Node parent, Void context) {
      lists.add(parent.getType() + "#" + list.getName() + " " + list.getKind() + " " + list.isContent() + " " + list.getNodes().size());
    }
  }

  @Test
  void testVisitsEachChildNodeListOfEveryNode() {
    ParseResult result = Herb.parse("<div><% if true %>a<% else %>b<% end %></div>");

    RecordingVisitor visitor = new RecordingVisitor();
    result.value.accept(visitor, null);

    assertEquals(
      Arrays.asList(
        "DocumentNode#children [Node] true 1",
        "HTMLElementNode#body [Node] true 1",
        "HTMLOpenTagNode#children [Node] true 0",
        "ERBIfNode#statements [Node] true 1",
        "ERBElseNode#statements [Node] true 1",
        "HTMLCloseTagNode#children [WhitespaceNode] true 0"
      ),
      visitor.lists
    );
  }

  @Test
  void testChildNodeListsExposesNameAndKindOfEveryArrayField() {
    ParseResult result = Herb.parse("<% items.each do |item| %><%= item %><% end %>");
    Node block = result.value.childNodeLists().get(0).getNodes().get(0);

    List<ChildNodeList> lists = block.childNodeLists();

    assertEquals("ERBBlockNode", block.getType());
    assertEquals(Arrays.asList("body", "block_arguments"), lists.stream().map(ChildNodeList::getName).collect(Collectors.toList()));
    assertEquals(Arrays.asList(Arrays.asList("Node"), Arrays.asList("RubyParameterNode")), lists.stream().map(ChildNodeList::getKind).collect(Collectors.toList()));
    assertEquals(Arrays.asList(true, false), lists.stream().map(ChildNodeList::isContent).collect(Collectors.toList()));
  }
}
