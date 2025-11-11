import { Worker } from "worker_threads"
import { cpus } from "os"

interface Task<T, R> {
  data: T
  resolve: (result: R) => void
  reject: (error: Error) => void
}

export class WorkerPool<T, R> {
  private workers: Worker[] = []
  private queue: Task<T, R>[] = []
  private activeWorkers = new Set<Worker>()
  private workerScriptPath: string

  constructor(workerScript: string, poolSize?: number) {
    this.workerScriptPath = workerScript
    const size = poolSize || Math.max(1, cpus().length - 1)

    for (let i = 0; i < size; i++) {
      this.createWorker()
    }
  }

  private createWorker(): void {
    const worker = new Worker(this.workerScriptPath)

    worker.on("message", (_result: R) => {
      this.activeWorkers.delete(worker)
      this.processNextTask(worker)
    })

    worker.on("error", (_error) => {
      this.activeWorkers.delete(worker)
      this.processNextTask(worker)
    })

    this.workers.push(worker)
  }

  private processNextTask(worker: Worker): void {
    const task = this.queue.shift()
    if (task) {
      this.activeWorkers.add(worker)

      const messageHandler = (result: R) => {
        worker.off("message", messageHandler)
        task.resolve(result)
      }

      worker.on("message", messageHandler)
      worker.postMessage(task.data)
    }
  }

  async execute(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: Task<T, R> = { data, resolve, reject }
      const idleWorker = this.workers.find(worker => !this.activeWorkers.has(worker))

      if (idleWorker) {
        this.activeWorkers.add(idleWorker)

        const messageHandler = (result: R) => {
          idleWorker.off("message", messageHandler)
          this.activeWorkers.delete(idleWorker)
          resolve(result)
          this.processNextTask(idleWorker)
        }

        idleWorker.on("message", messageHandler)
        idleWorker.postMessage(data)
      } else {
        this.queue.push(task)
      }
    })
  }

  async executeAll(tasks: T[]): Promise<R[]> {
    return Promise.all(tasks.map(task => this.execute(task)))
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()))

    this.workers = []
    this.activeWorkers.clear()
    this.queue = []
  }

  getPoolSize(): number {
    return this.workers.length
  }
}
