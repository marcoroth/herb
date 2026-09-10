type MutationRefresh = () => void

let hook: MutationRefresh | null = null

export function armMutationRefresh(fn: MutationRefresh): () => void {
  hook = fn

  return () => {
    if (hook === fn) {
      hook = null
    }
  }
}

export function mutationSettled(): void {
  hook?.()
}
