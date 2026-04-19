package org.herb;

import java.util.Arrays;

public class DiffOperation {
  private final String type;
  private final int[] path;
  private final Object oldNode;
  private final Object newNode;
  private final int oldIndex;
  private final int newIndex;

  public DiffOperation(String type, int[] path, Object oldNode, Object newNode, int oldIndex, int newIndex) {
    this.type = type;
    this.path = path;
    this.oldNode = oldNode;
    this.newNode = newNode;
    this.oldIndex = oldIndex;
    this.newIndex = newIndex;
  }

  public String getType() {
    return type;
  }

  public int[] getPath() {
    return path;
  }

  public Object getOldNode() {
    return oldNode;
  }

  public Object getNewNode() {
    return newNode;
  }

  public int getOldIndex() {
    return oldIndex;
  }

  public int getNewIndex() {
    return newIndex;
  }

  @Override
  public String toString() {
    return String.format("DiffOperation{type=%s, path=%s}", type, Arrays.toString(path));
  }
}
