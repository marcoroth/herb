package org.herb;

public class Herb {
  static {
    String libName = System.getProperty("herb.jni.library", "herb_jni");

    try {
      System.loadLibrary(libName);
    } catch (UnsatisfiedLinkError error) {
      System.err.println("Failed to load native library: " + libName);
      System.err.println("java.library.path: " + System.getProperty("java.library.path"));

      throw error;
    }
  }

  public static native String herbVersion();
  public static native String prismVersion();
  public static native ParseResult parse(String source, ParserOptions options);
  public static native LexResult lex(String source);
  public static native String extractRuby(String source, ExtractRubyOptions options);
  public static native String extractHTML(String source);

  public static ParseResult parse(String source) {
    return parse(source, null);
  }

  public static String extractRuby(String source) {
    return extractRuby(source, null);
  }

  public static String version() {
    return String.format("herb java v%s, libprism v%s, libherb v%s (Java JNI)", herbVersion(), prismVersion(), herbVersion());
  }
}
