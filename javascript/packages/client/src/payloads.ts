import type { Payload, PayloadSlots, PayloadValue, SlotValues } from "./types"

export function isPayload(value: PayloadValue | unknown): value is Payload {
  return typeof value === "object" && value !== null && "template" in value
}

export function leaves(values: PayloadSlots | undefined): SlotValues {
  const filled: SlotValues = {}

  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === "string") {
      filled[Number(key)] = value
    }
  }

  return filled
}
