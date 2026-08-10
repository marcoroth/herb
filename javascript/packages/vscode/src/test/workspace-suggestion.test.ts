import * as assert from 'assert'
import * as path from 'path'

import { outsideWorkspaceRoot } from '../workspace-suggestion'

suite('outsideWorkspaceRoot', () => {
  const workspace = path.join(path.sep, 'work', 'store')
  const outside = path.join(path.sep, 'elsewhere', 'blog')

  function erb(fsPath: string, overrides: { scheme?: string, languageId?: string } = {}) {
    return { fsPath, scheme: 'file', languageId: 'erb', ...overrides }
  }

  const findsRoot = (root: string) => () => root

  test('offers nothing for a document inside a workspace folder', () => {
    const file = path.join(workspace, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace], findsRoot(workspace)), null)
  })

  test('offers nothing when the folder path has a trailing separator', () => {
    const file = path.join(workspace, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace + path.sep], findsRoot(workspace)), null)
  })

  test('offers the project root for a document outside every folder', () => {
    const file = path.join(outside, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace], findsRoot(outside)), outside)
  })

  test('offers nothing when no folder is open at all', () => {
    const file = path.join(outside, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [], findsRoot(outside)), null)
  })

  test('offers nothing for a document that does not live on disk', () => {
    const file = path.join(outside, 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file, { scheme: 'git' }), [workspace], findsRoot(outside)), null)
  })

  test('offers nothing for a language Herb does not handle', () => {
    const file = path.join(outside, 'a.rb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file, { languageId: 'ruby' }), [workspace], findsRoot(outside)), null)
  })

  test('falls back to the file directory when the root does not contain it', () => {
    const file = path.join(outside, 'app', 'views', 'a.html.erb')
    const cwd = path.join(path.sep, 'somewhere', 'unrelated')

    assert.strictEqual(
      outsideWorkspaceRoot(erb(file), [workspace], findsRoot(cwd)),
      path.join(outside, 'app', 'views')
    )
  })

  test('does not treat a folder that merely shares a prefix as containing', () => {
    const sibling = `${workspace}-admin`
    const file = path.join(sibling, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace], findsRoot(sibling)), sibling)
  })

  test('offers a root that is an ancestor of an open folder', () => {
    const nested = path.join(workspace, 'admin')
    const file = path.join(workspace, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [nested], findsRoot(workspace)), workspace)
  })

  test('falls back to the file directory when finding the root throws', () => {
    const file = path.join(outside, 'app', 'views', 'a.html.erb')
    const throws = () => { throw new Error('Cannot read properties of undefined (reading \'configPath\')') }

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace], throws), path.join(outside, 'app', 'views'))
  })

  test('checks every open folder, not just the first', () => {
    const second = path.join(path.sep, 'work', 'blog')
    const file = path.join(second, 'app', 'views', 'a.html.erb')

    assert.strictEqual(outsideWorkspaceRoot(erb(file), [workspace, second], findsRoot(second)), null)
  })
})
