import { Result, HerbError, HerbWarning } from "@herb-tools/core"

export class FormatResult extends Result {
  readonly value: string

  constructor(
    value: string,
    source: string,
    warnings: HerbWarning[] = [],
    errors: HerbError[] = [],
  ) {
    super(source, warnings, errors)
    this.value = value
  }
}
