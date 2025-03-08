import fs from 'fs'
import path from 'path'

import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'
import { app } from './app.mjs'

const PORT = 5173
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const vite = await createViteServer({
  server: {
    middlewareMode: {
      server: app
    }
  },
  appType: 'custom'
})

app.use(vite.middlewares)

app.use('*', (request, response, next) => {
  try {
    const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
    response.status(200).set({ 'Content-Type': 'text/html' }).end(template)
  } catch (e) {
    vite.ssrFixStacktrace(e)
    next(e)
  }
})

app.listen(PORT, () => {
  console.log(`Listing on http://localhost:${PORT}`)
})
