package org.herb;

public class Range {
  private final int from;
  private final int to;

  public Range(int from, int to) {
    this.from = from;
    this.to = to;
  }

  public int getFrom() {
    return from;
  }

  public int getTo() {
    return to;
  }

  public int getLength() {
    return to - from;
  }

  @Override
  public String toString() {
    return inspect();
  }

  public String inspect() {
    return String.format("[%d, %d]", from, to);
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj) return true;
    if (!(obj instanceof Range)) return false;

    Range other = (Range) obj;

    return from == other.from && to == other.to;
  }

  @Override
  public int hashCode() {
    return 31 * from + to;
  }
}
