import type { Node, Token } from "@herb-tools/core"
import type { CollectedHerbDisable } from "./herb-disable-collector.js"

export interface OutputPosition {
  line: number
  column: number
}

/**
 * HerbDisablePositions records where each herb:disable anchor's output ends
 * while printing, so the collected comments can be spliced back onto their
 * own anchor's line afterwards.
 *
 * Output rendered inside `capture()` only reaches the printed lines once the
 * captured string is written, so marks made while capturing stay pending
 * until the next top-level write.
 */
export class HerbDisablePositions {
  private targets = new Set<Node | Token>()
  private positions = new Map<Node | Token, OutputPosition>()
  private pending: (Node | Token)[] = []
  private captureDepth = 0

  constructor(collected: CollectedHerbDisable[] = []) {
    for (const entry of collected) {
      if (entry.anchor) this.targets.add(entry.anchor)

      this.targets.add(entry.parentNode)
    }
  }

  enterCapture(): void {
    this.captureDepth++
  }

  exitCapture(): void {
    this.captureDepth--
  }

  mark(target: Node | Token, lines: string[]): void {
    if (!this.targets.has(target)) return

    if (this.captureDepth > 0) {
      this.pending.push(target)
    } else {
      this.record(target, lines)
    }
  }

  resolvePending(lines: string[]): void {
    if (this.captureDepth > 0) return

    this.pending.forEach(target => this.record(target, lines))
    this.pending = []
  }

  shiftFrom(index: number): void {
    for (const position of this.positions.values()) {
      if (position.line >= index) position.line++
    }
  }

  positionFor(entry: CollectedHerbDisable): OutputPosition | undefined {
    return (entry.anchor && this.positions.get(entry.anchor)) || this.positions.get(entry.parentNode)
  }

  private record(target: Node | Token, lines: string[]): void {
    const line = lines.length - 1

    this.positions.set(target, { line, column: lines[line]?.length ?? 0 })
  }
}
