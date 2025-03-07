import express from 'express'
import { parse } from './herb.mjs'

const headers = { 'Content-Type': 'application/json' }
const app = express()

app.use(express.text({ type: '*/*' }))

app.post('/api/analyze', async (request, response) => {
  try {
    const source = request.body
    const parseResult = await parse(source)

    response.status(200).set(headers).end(JSON.stringify(parseResult))
  } catch (e) {
    console.error('Error parsing source:', e)

    response.status(500).set(headers).end(JSON.stringify({
      error: e.message || 'An error occurred during parsing'
    }))
  }
})

export { app }
