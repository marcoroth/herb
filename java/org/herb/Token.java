package org.herb;

public class Token {
  private final String type;
  private final String value;
  private final Location location;
  private final Range range;

  public Token(String type, String value, Location location, Range range) {
    this.type = type;
    this.value = value;
    this.location = location;
    this.range = range;
  }

  public String getType() {
    return type;
  }

  public String getValue() {
    return value;
  }

  public Location getLocation() {
    return location;
  }

  public Range getRange() {
    return range;
  }

  @Override
  public String toString() {
    return inspect();
  }

  public String treeInspect() {
    String escapedValue = value.replace("\\", "\\\\")
                               .replace("\n", "\\n")
                               .replace("\r", "\\r")
                               .replace("\t", "\\t")
                               .replace("\"", "\\\"");
    return String.format("\"%s\" (location: %s)", escapedValue, location);
  }

  public String inspect() {
    return String.format("#<Herb::Token type=\"%s\" value=\"%s\" range=%s start=%s end=%s>",
      type,
      inspectValue(),
      range.inspect(),
      location.getStart().inspect(),
      location.getEnd().inspect()
    );
  }

  private String inspectValue() {
    if (type.equals("TOKEN_EOF")) {
      return "<EOF>";
    }

    return escaped(value);
  }

  private String escaped(String string) {
    return string.replace("\\", "\\\\")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                .replace("\"", "\\\"");
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj) return true;
    if (!(obj instanceof Token)) return false;

    Token other = (Token) obj;

    return type.equals(other.type) && value.equals(other.value) && location.equals(other.location);
  }

  @Override
  public int hashCode() {
    int result = type.hashCode();

    result = 31 * result + value.hashCode();
    result = 31 * result + location.hashCode();

    return result;
  }
}
