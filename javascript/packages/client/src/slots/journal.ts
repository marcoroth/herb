import type { Inverse, Restore, RevertToken, Slot, SlotAddress, TransactionResult } from "../types"

const MAX_KEPT = 50

export interface JournalDelegate {
  addressOf(slot: Slot): SlotAddress
  slotAt(address: SlotAddress): Slot | null
}

export class Journal {
  private delegate: JournalDelegate
  private kept = new Map<RevertToken, Inverse[]>()
  private recording: Inverse[] | null = null
  private nextToken = 1

  constructor(delegate: JournalDelegate) {
    this.delegate = delegate
  }

  transaction<T>(work: () => T): TransactionResult<T> {
    if (this.recording) {
      return { token: null, result: work() }
    }

    const inverses: Inverse[] = []

    this.recording = inverses

    let result: T

    try {
      result = work()
    } finally {
      this.recording = null
    }

    if (inverses.length === 0) {
      return { token: null, result }
    }

    const token = this.nextToken++

    this.kept.set(token, inverses)

    if (this.kept.size > MAX_KEPT) {
      const oldest = this.kept.keys().next().value

      if (oldest !== undefined) {
        this.kept.delete(oldest)
      }
    }

    return { token, result }
  }

  revert(token: RevertToken): boolean {
    const inverses = this.kept.get(token)

    if (!inverses) {
      return false
    }

    this.kept.delete(token)

    for (let position = inverses.length - 1; position >= 0; position -= 1) {
      inverses[position]()
    }

    return true
  }

  record(slot: Slot, capture: () => Restore): void {
    if (!this.recording) {
      return
    }

    const restore = capture()
    const address = this.delegate.addressOf(slot)

    this.recording.push(() => {
      const live = this.delegate.slotAt(address)

      if (live) {
        restore(live)
      }
    })
  }
}
