import type { ActionName } from "../grammar/attributes"
import type { DeclaredState, StateScope, StateValues } from "../state/types"

export type StateGroups = Map<StateScope, StateValues>

export interface ResolvedDeclaration {
  scope: StateScope
  declaration: DeclaredState
}

export interface Instruction {
  action: ActionName
  event: string
  rest: string
}
