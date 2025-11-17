import { ASTRewriter, StringRewriter, CustomRewriterLoader, getBuiltinRewriter, getBuiltinRewriterNames, isASTRewriterClass, isStringRewriterClass } from "@herb-tools/rewriter/loader"

export async function loadRewritersHelper(options: { baseDir: string, pre: string[], post?: string[], patterns?: string[], loadCustomRewriters?: boolean }) {
  const baseDir = options.baseDir
  const preNames = options.pre || []
  const postNames = options.post || []
  const patterns = options.patterns
  const loadCustom = options.loadCustomRewriters !== false
  const warnings: string[] = []
  const rewriterMap = new Map<string, any>()

  if (loadCustom) {
    const loader = new CustomRewriterLoader({ baseDir, patterns })
    const { rewriters: customRewriters, duplicateWarnings } = await loader.loadRewritersWithInfo()

    for (const RewriterClass of customRewriters) {
      const instance = new RewriterClass()

      if (rewriterMap.has(instance.name)) {
        warnings.push(`Rewriter "${instance.name}" is defined multiple times. Using the last definition.`)
      }

      rewriterMap.set(instance.name, RewriterClass)
    }

    warnings.push(...duplicateWarnings)
  }

  const allRequestedNames = [...preNames, ...postNames]
  const builtinNames = getBuiltinRewriterNames()

  for (const name of allRequestedNames) {
    if (!rewriterMap.has(name) && builtinNames.includes(name)) {
      const RewriterClass = await getBuiltinRewriter(name)

      if (RewriterClass) {
        rewriterMap.set(name, RewriterClass)
      }
    }
  }

  const preRewriters: ASTRewriter[] = []
  const postRewriters: StringRewriter[] = []

  for (const name of preNames) {
    const RewriterClass = rewriterMap.get(name)

    if (!RewriterClass) {
      warnings.push(`Pre-format rewriter "${name}" not found. Skipping.`)

      continue
    }

    if (!isASTRewriterClass(RewriterClass)) {
      warnings.push(`Rewriter "${name}" is not a pre-format rewriter. Skipping.`)

      continue
    }

    const instance = new RewriterClass()

    try {
      await instance.initialize({ baseDir })

      preRewriters.push(instance)
    } catch (error) {
      warnings.push(`Failed to initialize pre-format rewriter "${name}": ${error}`)
    }
  }

  for (const name of postNames) {
    const RewriterClass = rewriterMap.get(name)
    if (!RewriterClass) {
      warnings.push(`Post-format rewriter "${name}" not found. Skipping.`)

      continue
    }

    if (!isStringRewriterClass(RewriterClass)) {
      warnings.push(`Rewriter "${name}" is not a post-format rewriter. Skipping.`)

      continue
    }

    const instance = new RewriterClass()

    try {
      await instance.initialize({ baseDir })

      postRewriters.push(instance)
    } catch (error) {
      warnings.push(`Failed to initialize post-format rewriter "${name}": ${error}`)
    }
  }

  return { preRewriters, postRewriters, preCount: preRewriters.length, postCount: postRewriters.length, warnings }
}
