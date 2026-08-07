package org.herb;

import java.util.List;

public class DiffResult {
  private final boolean identical;
  private final List<DiffOperation> operations;

  public DiffResult(boolean identical, List<DiffOperation> operations) {
    this.identical = identical;
    this.operations = operations;
  }

  public boolean isIdentical() {
    return identical;
  }

  public List<DiffOperation> getOperations() {
    return operations;
  }

  public int getOperationCount() {
    return operations.size();
  }

  @Override
  public String toString() {
    if (identical) {
      return "DiffResult{identical=true}";
    }

    return String.format("DiffResult{identical=false, operations=%d}", operations.size());
  }
}
