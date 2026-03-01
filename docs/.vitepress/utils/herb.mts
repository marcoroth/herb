import { Herb } from '@herb-tools/node'

export async function initializeHerb() {
  try {
    await Herb.load()
    console.log('Herb initialized successfully:', Herb.initialized)
  } catch (error) {
    console.error('Failed to initialize Herb:', error)
    throw new Error(`Herb initialization failed: ${error.message}`)
  }
}
