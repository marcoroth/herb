export class Visitor {
  visitChildNodes(node: any) {
    // Mock implementation
  }
}

export const Herb = {
  load: async () => {
    // Mock implementation for WASM loading
    return Promise.resolve()
  },
  parse: (content: string) => ({
    visit: (visitor: any) => {
      // Mock implementation
    }
  })
}

export interface Node {
  errors: HerbError[]
  toJSON(): any
}

export interface HerbError {
  message: string
  type: string
  location: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  toJSON(): any
}
