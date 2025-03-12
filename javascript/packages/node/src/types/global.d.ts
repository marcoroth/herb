declare module "*.node" {
  const content: any
  export default content
}

declare module "@mapbox/node-pre-gyp" {
  export interface FindOptions {
    module_root?: string
    [key: string]: any
  }

  export interface NodePreGyp {
    find(packageJsonPath: string, opts?: FindOptions): string
  }

  declare const nodePreGyp: NodePreGyp
  export default nodePreGyp
}
