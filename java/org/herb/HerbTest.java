package org.herb;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

public class HerbTest {
  @Test
  void testVersion() {
    String version = Herb.version();

    assertNotNull(version);
    assertTrue(version.contains("herb java"));
  }

  @Test
  void testLexBasic() {
    LexResult result = Herb.lex("<div><%= foo %></div>");

    assertFalse(result.isEmpty());
    assertTrue(result.tokens.size() > 0);
    assertEquals("TOKEN_HTML_TAG_START", result.tokens.get(0).getType());

    Token last = result.tokens.get(result.tokens.size() - 1);
    assertEquals("TOKEN_EOF", last.getType());
  }

  @Test
  void testLexEmpty() {
    LexResult result = Herb.lex("");

    assertFalse(result.isEmpty());

    Token last = result.tokens.get(result.tokens.size() - 1);
    assertEquals("TOKEN_EOF", last.getType());
  }

  @Test
  void testLexTokenValues() {
    LexResult result = Herb.lex("<h1>hello</h1>");
    String inspected = result.inspect();

    assertTrue(inspected.contains("TOKEN_HTML_TAG_START"));
    assertTrue(inspected.contains("TOKEN_IDENTIFIER"));
  }

  @Test
  void testParseBasic() {
    ParseResult result = Herb.parse("<div><%= foo %></div>");

    assertNotNull(result.value);
    assertTrue(result.isSuccessful());
    assertFalse(result.hasErrors());
    assertEquals("DocumentNode", result.value.getType());
  }

  @Test
  void testParseEmpty() {
    ParseResult result = Herb.parse("");

    assertNotNull(result.value);
    assertTrue(result.isSuccessful());
  }

  @Test
  void testParseWithErrors() {
    ParseResult result = Herb.parse("<div>");

    assertNotNull(result.value);
    assertTrue(result.hasErrors());
    assertTrue(result.getErrorCount() > 0);
  }

  @Test
  void testExtractRuby() {
    String ruby = Herb.extractRuby("<%= foo %>");

    assertNotNull(ruby);
    assertTrue(ruby.contains("foo"));
  }

  @Test
  void testExtractHTML() {
    String html = Herb.extractHTML("<div><%= foo %></div>");

    assertNotNull(html);
    assertTrue(html.contains("<div>"));
    assertTrue(html.contains("</div>"));
  }

  @Test
  void testParserOptionsTrackWhitespace() {
    String source = "<div     class=\"example\">content</div>";

    ParseResult withoutTrackWhitespace = Herb.parse(source);
    ParseResult withTrackWhitespace = Herb.parse(source, ParserOptions.create().trackWhitespace(true));

    String inspectWithout = withoutTrackWhitespace.value.inspect();
    String inspectWith = withTrackWhitespace.value.inspect();

    assertTrue(inspectWith.contains("WhitespaceNode"));
    assertFalse(inspectWithout.contains("WhitespaceNode"));
  }

  @Test
  void testParserOptionsAnalyze() {
    String source = "<% if true %><div></div><% end %>";

    ParseResult withAnalyze = Herb.parse(source, ParserOptions.create().analyze(true));
    ParseResult withoutAnalyze = Herb.parse(source, ParserOptions.create().analyze(false));

    String inspectWith = withAnalyze.value.inspect();
    String inspectWithout = withoutAnalyze.value.inspect();

    assertTrue(inspectWith.contains("ERBIfNode"));
    assertFalse(inspectWithout.contains("ERBIfNode"));
  }
}
