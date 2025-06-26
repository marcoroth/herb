import { Connection } from 'vscode-languageserver/node'

export function createMockConnection(): Connection {
  const calls: { [key: string]: any[] } = {}
  
  const addCall = (method: string, ...args: any[]) => {
    if (!calls[method]) calls[method] = []
    calls[method].push(args)
  }

  const mockConnection = {
    // Core communication methods
    sendDiagnostics: (...args: any[]) => addCall('sendDiagnostics', ...args),
    sendNotification: (...args: any[]) => addCall('sendNotification', ...args),
    sendRequest: (...args: any[]) => addCall('sendRequest', ...args),
    
    // Document event handlers
    onDidOpenTextDocument: () => {},
    onDidChangeTextDocument: () => {},
    onDidCloseTextDocument: () => {},
    onWillSaveTextDocument: () => {},
    onWillSaveTextDocumentWaitUntil: () => {},
    onDidSaveTextDocument: () => {},
    
    // Configuration and workspace
    onDidChangeConfiguration: () => {},
    onDidChangeWatchedFiles: () => {},
    onDidRenameFiles: () => {},
    onDidCreateFiles: () => {},
    onDidDeleteFiles: () => {},
    
    // Initialization
    onInitialize: () => {},
    onInitialized: () => {},
    onShutdown: () => {},
    onExit: () => {},
    
    // Client capabilities
    client: {
      register: (...args: any[]) => addCall('client.register', ...args),
      unregister: (...args: any[]) => addCall('client.unregister', ...args)
    },
    
    // Workspace
    workspace: {
      onDidChangeWorkspaceFolders: () => {},
      getWorkspaceFolders: () => [],
      getConfiguration: () => ({})
    },
    
    // Console/logging
    console: {
      log: (...args: any[]) => addCall('console.log', ...args),
      info: (...args: any[]) => addCall('console.info', ...args),
      warn: (...args: any[]) => addCall('console.warn', ...args),
      error: (...args: any[]) => addCall('console.error', ...args)
    },
    
    // Connection management
    listen: () => {},
    dispose: () => {},
    
    // Access to call history for testing
    __calls: calls
  } as any

  return mockConnection
}