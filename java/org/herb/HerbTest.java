package org.herb;

// Note: We currently don't have a Java build tool. Instead of going down the
// Maven/Gradle rabbit hole, this should suffice for now. We're not attempting
// to re-test the C library, only the wrapping code.

public class HerbTest {
  private static int passed = 0;
  private static int failed = 0;

  public static void main(String[] args) {
    run("testVersion", HerbTest::testVersion);
    run("testLexBasic", HerbTest::testLexBasic);
    run("testLexEmpty", HerbTest::testLexEmpty);
    run("testLexTokenValues", HerbTest::testLexTokenValues);
    run("testParseBasic", HerbTest::testParseBasic);
    run("testParseEmpty", HerbTest::testParseEmpty);
    run("testParseWithErrors", HerbTest::testParseWithErrors);
    run("testExtractRuby", HerbTest::testExtractRuby);
    run("testExtractHTML", HerbTest::testExtractHTML);
    run("testParserOptionsTrackWhitespace", HerbTest::testParserOptionsTrackWhitespace);
    run("testParserOptionsAnalyze", HerbTest::testParserOptionsAnalyze);

    System.out.println();
    System.out.println(passed + " passed, " + failed + " failed, " + (passed + failed) + " total");

    if (failed > 0) {
      System.exit(1);
    }
  }

  // region Tests
  static void testVersion() {
    String version = Herb.version();

    assertNotNull(version, "version");
    assertContains(version, "herb java", "version string");
  }

  static void testLexBasic() {
    LexResult result = Herb.lex("<div><%= foo %></div>");

    assertFalse(result.isEmpty(), "lex result should not be empty");
    assertTrue(result.tokens.size() > 0, "should have tokens");
    assertEqual(result.tokens.get(0).getType(), "TOKEN_HTML_TAG_START", "first token type");
    Token last = result.tokens.get(result.tokens.size() - 1);
    assertEqual(last.getType(), "TOKEN_EOF", "last token type");
  }

  static void testLexEmpty() {
    LexResult result = Herb.lex("");

    assertFalse(result.isEmpty(), "empty lex should still have EOF");
    Token last = result.tokens.get(result.tokens.size() - 1);
    assertEqual(last.getType(), "TOKEN_EOF", "last token is EOF");
  }

  static void testLexTokenValues() {
    LexResult result = Herb.lex("<h1>hello</h1>");
    String inspected = result.inspect();

    assertContains(inspected, "TOKEN_HTML_TAG_START", "lex result");
    assertContains(inspected, "TOKEN_IDENTIFIER", "lex result");
  }

  static void testParseBasic() {
    ParseResult result = Herb.parse("<div><%= foo %></div>");

    assertNotNull(result.value, "parse result value");
    assertTrue(result.isSuccessful(), "parse should succeed");
    assertFalse(result.hasErrors(), "should have no errors");
    assertEqual(result.value.getType(), "DocumentNode", "root node type");
  }

  static void testParseEmpty() {
    ParseResult result = Herb.parse("");

    assertNotNull(result.value, "empty parse result value");
    assertTrue(result.isSuccessful(), "empty parse should succeed");
  }

  static void testParseWithErrors() {
    ParseResult result = Herb.parse("<div>");

    assertNotNull(result.value, "error parse result value");
    assertTrue(result.hasErrors(), "unclosed tag should have errors");
    assertTrue(result.getErrorCount() > 0, "should have at least one error");
  }

  static void testExtractRuby() {
    String ruby = Herb.extractRuby("<%= foo %>");

    assertNotNull(ruby, "extracted ruby");
    assertContains(ruby, "foo", "ruby extraction");
  }

  static void testExtractHTML() {
    String html = Herb.extractHTML("<div><%= foo %></div>");

    assertNotNull(html, "extracted html");
    assertContains(html, "<div>", "html extraction");
    assertContains(html, "</div>", "html extraction");
  }

  static void testParserOptionsTrackWhitespace() {
    String source = "<div     class=\"example\">content</div>";

    ParseResult withoutTrackWhitespace = Herb.parse(source);
    ParseResult withTrackWhitespace = Herb.parse(source, ParserOptions.create().trackWhitespace(true));

    String inspectWithout = withoutTrackWhitespace.value.inspect();
    String inspectWith = withTrackWhitespace.value.inspect();

    assertContains(inspectWith, "WhitespaceNode", "track_whitespace should produce WhitespaceNode");
    assertNotContains(inspectWithout, "WhitespaceNode", "default should not produce WhitespaceNode");
  }

  static void testParserOptionsAnalyze() {
    String source = "<% if true %><div></div><% end %>";

    ParseResult withAnalyze = Herb.parse(source, ParserOptions.create().analyze(true));
    ParseResult withoutAnalyze = Herb.parse(source, ParserOptions.create().analyze(false));

    String inspectWith = withAnalyze.value.inspect();
    String inspectWithout = withoutAnalyze.value.inspect();

    assertContains(inspectWith, "ERBIfNode", "analyze should produce ERBIfNode");
    assertNotContains(inspectWithout, "ERBIfNode", "no analyze should not produce ERBIfNode");
  }
  // endregion

  // region Test runner
  private static void run(String name, Runnable test) {
    try {
      test.run();
      passed++;
      System.out.println("  PASS " + name);
    } catch (AssertionError e) {
      failed++;
      System.out.println("  FAIL " + name + ": " + e.getMessage());
    }
  }
  // endregion

  // region Assertion helpers
  private static void assertTrue(boolean condition, String message) {
    if (!condition) {
      throw new AssertionError(message);
    }
  }

  private static void assertFalse(boolean condition, String message) {
    if (condition) {
      throw new AssertionError(message);
    }
  }

  private static void assertNotNull(Object value, String label) {
    if (value == null) {
      throw new AssertionError(label + " should not be null");
    }
  }

  private static void assertEqual(String actual, String expected, String label) {
    if (!expected.equals(actual)) {
      throw new AssertionError(label + ": expected \"" + expected + "\", got \"" + actual + "\"");
    }
  }

  private static void assertContains(String haystack, String needle, String label) {
    if (!haystack.contains(needle)) {
      throw new AssertionError(label + " should contain \"" + needle + "\", got \"" + haystack + "\"");
    }
  }

  private static void assertNotContains(String haystack, String needle, String label) {
    if (haystack.contains(needle)) {
      throw new AssertionError(label + " should not contain \"" + needle + "\"");
    }
  }
  // endregion
}
