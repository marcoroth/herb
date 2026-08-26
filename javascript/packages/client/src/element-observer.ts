export interface ElementObserverDelegate {
  nodesAdded?(nodes: Node[]): void
  nodesRemoved?(nodes: Node[]): void
  attributeChanged?(element: Element, name: string): void
}

export class ElementObserver {
  private readonly attributeFilter: string[]
  private readonly delegates = new Set<ElementObserverDelegate>()

  private observer: MutationObserver | null = null
  private root: Node | null = null

  constructor(attributeFilter: string[] = []) {
    this.attributeFilter = attributeFilter
  }

  add(delegate: ElementObserverDelegate): () => void {
    this.delegates.add(delegate)

    return () => this.remove(delegate)
  }

  remove(delegate: ElementObserverDelegate): void {
    this.delegates.delete(delegate)

    if (this.delegates.size === 0) {
      this.disconnect()
    }
  }

  observe(root: Node): void {
    if (this.observer && this.root === root) {
      return
    }

    this.observer?.disconnect()
    this.root = root
    this.observer = new MutationObserver((records) => this.deliver(records))

    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: this.attributeFilter,
    })
  }

  disconnect(): void {
    this.observer?.disconnect()
    this.observer = null
    this.root = null
  }

  private deliver(records: MutationRecord[]): void {
    const added: Node[] = []
    const removed: Node[] = []

    for (const record of records) {
      added.push(...record.addedNodes)
      removed.push(...record.removedNodes)
    }

    if (added.length > 0) {
      for (const delegate of [...this.delegates]) {
        delegate.nodesAdded?.(added)
      }
    }

    if (removed.length > 0) {
      for (const delegate of [...this.delegates]) {
        delegate.nodesRemoved?.(removed)
      }
    }

    for (const record of records) {
      if (record.type !== "attributes" || !(record.target instanceof Element) || !record.attributeName) {
        continue
      }

      for (const delegate of [...this.delegates]) {
        delegate.attributeChanged?.(record.target, record.attributeName)
      }
    }
  }
}
