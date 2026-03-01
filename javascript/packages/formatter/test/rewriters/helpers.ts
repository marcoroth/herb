import { ASTRewriter, StringRewriter, CustomRewriterLoader, builtinRewriters, isASTRewriterClass, isStringRewriterClass } from "@herb-tools/rewriter/loader"

export async function loadRewritersHelper(options: { baseDir: string, pre: string[], post?: string[], patterns?: string[], loadCustomRewriters?: boolean }) {
  const baseDir = options.baseDir
  const preNames = options.pre || []
  const postNames = options.post || []
  const patterns = options.patterns
  const loadCustom = options.loadCustomRewriters !== false
  const warnings: string[] = []
  const allRewriterClasses: any[] = []

  allRewriterClasses.push(...builtinRewriters)

  if (loadCustom) {
    const loader = new CustomRewriterLoader({ baseDir, patterns })
    const { rewriters: customRewriters, duplicateWarnings } = await loader.loadRewritersWithInfo()

    allRewriterClasses.push(...customRewriters)
    warnings.push(...duplicateWarnings)
  }

  const rewriterMap = new Map<string, any>()

  for (const RewriterClass of allRewriterClasses) {
    const instance = new RewriterClass()

    if (rewriterMap.has(instance.name)) {
      warnings.push(`Rewriter "${instance.name}" is defined multiple times. Using the last definition.`)
    }

    rewriterMap.set(instance.name, RewriterClass)
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
