/**
 * Context passed to rewriters during initialization and rewriting
 *
 * Provides information about the current file and project being processed
 */
export interface RewriteContext {
  /**
   * Path to the file being rewritten (if available)
   */
  filePath?: string

  /**
   * Base directory of the project
   */
  baseDir: string

  /**
   * Additional context data that can be added by the framework
   */
  [key: string]: any
}
