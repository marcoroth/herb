export function yaml() {
  return {
    name: "yaml-loader",
    transform(code, id) {
      if (id.endsWith(".yml") || id.endsWith(".yaml")) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null
        }
      }
    }
  }
}
