# Using Herb with Neovim

Multiple ways to integrate the Herb Language Server with Neovim for HTML+ERB development.

![Herb with Neovim](/herb-neovim.png)

## Installation Options

### [`nvim-lspconfig`](https://github.com/neovim/nvim-lspconfig)

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

Then you can set up Herb using `nvim-lspconfig` with a simple configuration:


::: code-group

```lua [nvim <= 0.10]
require('lspconfig').herb_ls.setup()
```

```lua [nvim 0.11+]
require('lspconfig')
vim.lsp.enable('herb_ls')
```

:::

### [`mason.nvim`](https://github.com/mason-org/mason.nvim)

Install the Herb Language Server using Mason:

1. Open Mason: `:Mason`
2. Search for `herb-language-server`
3. Install with `i`

Then configure in your `init.lua`:

```lua
require('lspconfig').herb_ls.setup()
```

### Manual Configuration

First, install the language server globally:

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

Then add this to your Neovim configuration:

:::code-group

```lua [Lua]
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "eruby", "erb" },
  callback = function()
    vim.lsp.start({
      name = "herb-language-server",
      cmd = { "herb-language-server", "--stdio" },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git", "Gemfile" }, { upward = true })[1]),
      capabilities = require('cmp_nvim_lsp').default_capabilities(),
    })
  end,
})
```

```vim [Vimscript]
augroup HerbLSP
  autocmd!
  autocmd FileType eruby,erb call s:StartHerbLSP()
augroup END

function! s:StartHerbLSP()
  if executable('herb-language-server')
    call v:lua.vim.lsp.start({
      \ 'name': 'herb-language-server',
      \ 'cmd': ['herb-language-server', '--stdio'],
      \ 'root_dir': v:lua.vim.fs.dirname(v:lua.vim.fs.find(['.git', 'Gemfile'], {'upward': v:true})[0])
      \ })
  endif
endfunction
```
:::

## Troubleshooting

Check if the server is running:
```vim
:LspInfo
```

View server logs:
```vim
:LspLog
```

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).
