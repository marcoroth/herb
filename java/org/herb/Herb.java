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

  public native String version();
  public native String prismVersion();
  public native ParseResult parse(String source, ParserOptions options);
  public native LexResult lex(String source);
  public native String extractRuby(String source);
  public native String extractHTML(String source);

  public ParseResult parse(String source) {
    return parse(source, null);
  }

  public String getFullVersion() {
    return String.format("herb java v%s, libprism v%s, libherb v%s (Java JNI)", version(), prismVersion(), version());
  }

  public static Herb create() {
    return new Herb();
  }
}
