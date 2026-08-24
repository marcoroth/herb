/**
 * Applying a values payload to the index.
 *
 * This walks the shape a payload describes and decides what the page has to become: which value
 * goes where, which branch a conditional took, which items a collection holds. The index owns the
 * writing; this owns reading the payload and saying what it means. Anything that needs markup the
 * page never had is reported as deferred.
 */

import { isPayload, leaves } from "./payloads"
import { attributeValue } from "./fragments"

import type { SlotIndex } from "./slot-index"
import type { AppliedValue, ApplyMode, ApplyReport, Branched, Collected, DeferredReason, Payload, PayloadSlots, SeededSlots, Slot, SlotMap, SlotValue } from "./types"

export function applyPayload(slots: SlotIndex, payload: Payload, mode: ApplyMode): ApplyReport {
  const report: ApplyReport = { applied: 0, deferred: [] }

  apply(slots, payload, report, mode)

  return report
}

function owner(slot: Slot): SlotMap {
  return slot.item?.slots ?? slot.region.slots
}

function apply(slots: SlotIndex, payload: Payload, report: ApplyReport, mode: ApplyMode): void {
    const region = slots.region(payload.template, payload.occurrence)

    if (!region) {
      defer(report, payload, null, "no-region")

      return
    }

    if (region.version !== payload.version) {
      defer(report, payload, null, "stale-version")

      return
    }

    if (payload.seeds) {
      region.seeds = { ...(region.seeds ?? {}), ...payload.seeds }
    }

    applySlots(slots, payload, region.slots, payload.slots, report, mode)
  }

function applySlots(slots: SlotIndex, payload: Payload, container: SlotMap, values: PayloadSlots, report: ApplyReport, mode: ApplyMode): void {
    const blocks: [Slot, number, AppliedValue][] = []

    for (const [key, value] of Object.entries(values)) {
      if (isPayload(value)) {
        apply(slots, value, report, mode)

        continue
      }

      const index = Number(key)
      const slot = container.get(index)

      if (!slot) {
        defer(report, payload, index, "no-slot")

        continue
      }

      if (slot.claimed) {
        continue
      }

      if (slot.type === "block" && slot.children.length > 0) {
        blocks.push([slot, index, value])

        continue
      }

      applyValue(slots, payload, slot, index, value, report, mode)
    }

    for (const [slot, index, value] of blocks) {
      applyValue(slots, payload, slot, index, value, report, mode)
    }
  }

function applyValue(slots: SlotIndex, payload: Payload, slot: Slot, index: number, value: AppliedValue, report: ApplyReport, mode: ApplyMode): void {
    if (typeof value === "boolean") {
      if (slots.setBooleanAttribute(slot, value)) {
        report.applied += 1
      } else {
        defer(report, payload, index, "partial-attribute")
      }

      return
    }

    if (typeof value === "string" || Array.isArray(value)) {
      applyLeaf(slots, payload, slot, index, value, report)

      return
    }

    if ("items" in value) {
      applyItems(slots, payload, slot, value, report, mode)
    } else {
      applyBranch(slots, payload, slot, value, report, mode)
    }
  }

function applyLeaf(slots: SlotIndex, payload: Payload, slot: Slot, index: number, value: SlotValue, report: ApplyReport): void {
    if (slot.type === "block" && slot.children.length > 0) {
      if (!slots.covers(slot, value)) {
        defer(report, payload, index, "block")
      }

      return
    }

    const written = slot.attribute ? attributeValue(value) : value

    if (slots.matches(slot, written)) {
      return
    }

    if (slot.attribute) {
      if (!slots.setAttribute(slot, written)) {
        defer(report, payload, index, "partial-attribute")

        return
      }
    } else {
      if (Array.isArray(written)) {
        defer(report, payload, index, "partial-attribute")

        return
      }

      slots.update(slot, written)
    }

    report.applied += 1
  }

function applyBranch(slots: SlotIndex, payload: Payload, slot: Slot, value: Branched, report: ApplyReport, mode: ApplyMode): void {
    if (value.branch !== slot.branch) {
      if (!slots.switchBranch(slot, value.branch, leaves(value.slots))) {
        defer(report, payload, slot.index, "branch")

        return
      }

      report.applied += 1
    }

    if (value.slots) {
      applySlots(slots, payload, owner(slot), value.slots, report, mode)
    }
  }

function applyItems(slots: SlotIndex, payload: Payload, slot: Slot, value: Collected, report: ApplyReport, mode: ApplyMode): void {
    const wanted = value.order ?? Object.keys(value.items)

    const unbuilt = slots.reconcileItems(slot, wanted, mode)

    if (unbuilt.length > 0) {
      defer(report, payload, slot.index, "items", unbuilt)
    }

    for (const key of wanted) {
      const item = slot.items.get(key)

      if (!item) {
        continue
      }

      const { seeds, ...rest } = value.items[key] as SeededSlots

      if (seeds) {
        item.seeds = { ...(item.seeds ?? {}), ...seeds }
      }

      applySlots(slots, payload, item.slots, rest, report, mode)
    }
  }

function defer(report: ApplyReport, payload: Payload, index: number | null, reason: DeferredReason, keys?: string[]): void {
    const deferred = { file: payload.template, occurrence: payload.occurrence, index, reason }

    if (keys) {
      report.deferred.push({ ...deferred, keys })

      return
    }

    report.deferred.push(deferred)
  }
