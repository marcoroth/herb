package org.herb;

public class Location {
  private final Position start;
  private final Position end;

  public Location(Position start, Position end) {
    this.start = start;
    this.end = end;
  }

  public Position getStart() {
    return start;
  }

  public Position getEnd() {
    return end;
  }

  @Override
  public String toString() {
    return inspect();
  }

  public String inspect() {
    return String.format("%s-%s", start, end);
  }

  public String treeInspect() {
    return String.format("%s-%s", start.treeInspect(), end.treeInspect());
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj) return true;
    if (!(obj instanceof Location)) return false;
    Location other = (Location) obj;
    return start.equals(other.start) && end.equals(other.end);
  }

  @Override
  public int hashCode() {
    return 31 * start.hashCode() + end.hashCode();
  }
}
