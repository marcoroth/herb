import express from 'express'
import { parse } from './herb.mjs'

import { Herb } from "@herb-tools/node"

const headers = { 'Content-Type': 'application/json' }
const app = express()

app.use(express.text({ type: '*/*' }))

app.post('/api/analyze', async (request, response) => {
  try {
    const source = request.body

    response.status(200).set(headers).end(
      JSON.stringify({
        string: Herb.parse(source).value.inspect(),
        json: JSON.stringify(Herb.parse(source).ast, null, 2),
        lex: Herb.lex(source).value.inspect(),
        ruby: Herb.extractRuby(source),
        html: Herb.extractHtml(source),
      })
    )
  } catch (e) {
    console.error('Error parsing source:', e)

    response.status(500).set(headers).end(JSON.stringify({
      error: e.message || 'An error occurred during parsing'
    }))
  }
})

export { app }
