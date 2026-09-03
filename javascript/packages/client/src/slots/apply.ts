import { attributeValue } from "../markup/fragments"
import { report as reportDiagnostic } from "../shared/report"

import type { Slots } from "./slots"
import type { AppliedValue, ApplyMode, ApplyReport, Branched, Collected, DeferredReason, Payload, PayloadSlots, PayloadValue, SeededSlots, Slot, SlotMap, SlotValue, SlotValues } from "../types"

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

export function applyPayload(slots: Slots, payload: Payload, mode: ApplyMode): ApplyReport {
  const report: ApplyReport = { applied: 0, deferred: [] }

  apply(slots, payload, report, mode)

  return report
}

function owner(slot: Slot): SlotMap {
  return slot.item?.slots ?? slot.region.slots
}

function apply(slots: Slots, payload: Payload, report: ApplyReport, mode: ApplyMode): void {
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

function applySlots(slots: Slots, payload: Payload, container: SlotMap, values: PayloadSlots, report: ApplyReport, mode: ApplyMode): void {
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
        if (
          slot.type === "conditional" &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          "branch" in value &&
          !("items" in value) &&
          value.slots
        ) {
          const parked = parkBranchStatics(slots, payload, slot, value as Branched)

          if (value.branch === slot.branch) {
            applySlots(slots, payload, owner(slot), value.slots, report, mode)
          } else if (value.branch !== null) {
            const shown = slot.shown ?? new Map<number, SlotValues>()

            shown.set(value.branch, { ...(shown.get(value.branch) ?? {}), ...leaves(value.slots) })
            slot.shown = shown
          }

          if (parked) {
            slots.announceBranchMaterial(slot)
          }
        }

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

function applyValue(slots: Slots, payload: Payload, slot: Slot, index: number, value: AppliedValue, report: ApplyReport, mode: ApplyMode): void {
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

function applyLeaf(slots: Slots, payload: Payload, slot: Slot, index: number, value: SlotValue, report: ApplyReport): void {
    if (slot.type === "block" && slot.children.length > 0) {
      if (!slots.covers(slot, value)) {
        defer(report, payload, index, "block")
      }

      return
    }

    const written = slot.attribute ? attributeValue(value) : value

    if (slots.holds(slot, written)) {
      return
    }

    if (slot.attribute) {
      if (!slots.setAttribute(slot, written)) {
        defer(report, payload, index, "partial-attribute")

        return
      }
    } else if (slot.type === "raw_text_interpolation") {
      if (!slots.setText(slot, written)) {
        defer(report, payload, index, "partial-content")

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

function parkBranchStatics(slots: Slots, payload: Payload, slot: Slot, value: Branched): boolean {
    if (value.branch === null || !value.statics) {
      return false
    }

    slots.holdStatics(
      { file: payload.template, version: payload.version },
      { [`${slot.index}:${value.branch}`]: value.statics },
    )

    return true
  }

function applyBranch(slots: Slots, payload: Payload, slot: Slot, value: Branched, report: ApplyReport, mode: ApplyMode): void {
    parkBranchStatics(slots, payload, slot, value)

    if (value.branch !== slot.branch) {
      if (!slots.switchBranch(slot, value.branch, leaves(value.slots))) {
        reportDiagnostic({
          template: payload.template,
          message: `The payload picked branch ${value.branch} of a conditional this page has no material for, so the branch cannot be shown.`,
          code: "herb-slots-materialize",
          severity: "warning",
          suggestion: "Render the page with `herb:slots client` to park every branch, or serve the values from a build that sends the branch statics along.",
        })
        defer(report, payload, slot.index, "branch")

        return
      }

      report.applied += 1
    }

    if (value.slots) {
      applySlots(slots, payload, owner(slot), value.slots, report, mode)
    }
  }

function applyItems(slots: Slots, payload: Payload, slot: Slot, value: Collected, report: ApplyReport, mode: ApplyMode): void {
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
