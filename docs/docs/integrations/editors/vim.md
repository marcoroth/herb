# Using Herb with Vim

Configure the Herb Language Server with traditional Vim for HTML+ERB development.

![Herb with Vim](/herb-vim.png)

## Installation

### Manual Configuration

First, install the Herb Language Server globally:

:::code-group

```bash [npm]
npm install -g @herb-tools/language-server
```

```bash [yarn]
yarn global add @herb-tools/language-server
```

```bash [pnpm]
pnpm add -g @herb-tools/language-server
```

```bash [bun]
bun add -g @herb-tools/language-server
```
:::

Then configure Vim to use the language server. You'll need an LSP client plugin like:

- [`ale`](https://github.com/dense-analysis/ale)
- [`vim-lsp`](https://github.com/prabirshrestha/vim-lsp)
- [`coc.nvim`](https://github.com/neoclide/coc.nvim)

### Example with `vim-lsp`

Add to your `.vimrc`:

```vim
if executable('herb-language-server')
  au User lsp_setup call lsp#register_server({
    \ 'name': 'herb-ls',
    \ 'cmd': {server_info->['herb-language-server', '--stdio']},
    \ 'allowlist': ['eruby', 'erb'],
    \ })
endif
```

### Example with `coc.nvim`

Add to your `coc-settings.json`:

```json
{
  "languageserver": {
    "herb": {
      "command": "herb-language-server",
      "args": ["--stdio"],
      "filetypes": ["eruby", "erb"],
      "rootPatterns": [".git", "Gemfile"]
    }
  }
}
```

### Example with `ALE`

Add to your `.vimrc` to register the Herb Language Server with ALE:

```vim
let g:ale_linters = {
\   'eruby': ['herb'],
\   'erb': ['herb'],
\}

" Define the herb linter
call ale#linter#Define('eruby', {
\   'name': 'herb',
\   'lsp': 'stdio',
\   'executable': 'herb-language-server',
\   'command': '%e --stdio',
\   'project_root': function('ale#ruby#FindProjectRoot'),
\   'language': 'eruby',
\})

" Also define for erb filetype
call ale#linter#Define('erb', {
\   'name': 'herb',
\   'lsp': 'stdio',
\   'executable': 'herb-language-server',
\   'command': '%e --stdio',
\   'project_root': function('ale#ruby#FindProjectRoot'),
\   'language': 'eruby',
\})
```

Alternatively, for a simpler setup, you can use ALE's generic LSP support:

```vim
let g:ale_linters = {
\   'eruby': ['ale_lsp'],
\   'erb': ['ale_lsp'],
\}

augroup AleHerbLSP
  autocmd!
  autocmd User ALEWantResults call ale#lsp#RegisterLSP('eruby', {
  \   'name': 'herb-language-server',
  \   'executable': 'herb-language-server',
  \   'command': '%e --stdio',
  \   'project_root': {buffer -> ale#path#FindNearestDirectory(buffer, '.git')},
  \})
augroup END
```

## Troubleshooting

Ensure the language server is in your PATH:
```bash
which herb-language-server
```

Check your LSP client's documentation for debugging commands.

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).
