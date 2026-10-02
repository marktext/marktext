import net from 'net'
import path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Same names as marktextMcpServer.ts. This process must not import the main graph.
const BRIDGE_ADDR = 'MARKTEXT_BRIDGE_ADDR'
const BRIDGE_TOKEN = 'MARKTEXT_BRIDGE_TOKEN'
const TOOL_NAME = 'reply_to_thread'
const TOOL_DESCRIPTION = 'Post your answer to a MarkText comment thread. Call once per thread in the current request. Does not change thread status.'
const CONNECT_TIMEOUT_MS = 10_000

type ToolResult = {
  content: { type: 'text', text: string }[]
  isError?: boolean
}

const toolError = (text: string): ToolResult => ({
  content: [{ type: 'text', text }],
  isError: true
})

/**
 * One ndjson request to the main-process bridge. Rejects with a message the
 * model can read when the socket cannot be reached or the bridge refuses.
 */
export const postReply = (address: string, token: string, threadId: string, text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = net.connect(address)
    let buffer = ''
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(error)
    }
    const succeed = (): void => {
      if (settled) return
      settled = true
      socket.end()
      resolve()
    }
    socket.setEncoding('utf8')
    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.on('timeout', () => {
      fail(new Error(`Could not connect to the MarkText bridge at ${address}: timed out`))
    })
    socket.on('error', (error: NodeJS.ErrnoException) => {
      fail(new Error(`Could not connect to the MarkText bridge at ${address}: ${error.message}`))
    })
    socket.on('close', () => {
      fail(new Error('MarkText bridge closed the connection.'))
    })
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      let parsed: unknown
      try {
        parsed = JSON.parse(buffer.slice(0, newline))
      } catch {
        fail(new Error('MarkText bridge returned an invalid response.'))
        return
      }
      if (!parsed || typeof parsed !== 'object') {
        fail(new Error('MarkText bridge returned an invalid response.'))
        return
      }
      const body = parsed as { ok?: unknown, error?: unknown }
      if (body.ok === true) {
        succeed()
        return
      }
      const message = typeof body.error === 'string' && body.error.length > 0
        ? body.error
        : 'MarkText bridge rejected the reply.'
      fail(new Error(message))
    })
    socket.write(`${JSON.stringify({
      token,
      method: TOOL_NAME,
      params: { threadId, text }
    })}\n`)
  })

/** Stdio MCP server with the one reply tool. stdout is the protocol stream. */
export const createReplyMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'marktext', version: '1.0.0' })
  server.registerTool(
    TOOL_NAME,
    {
      description: TOOL_DESCRIPTION,
      inputSchema: {
        threadId: z.string(),
        text: z.string()
      }
    },
    async({ threadId, text }): Promise<ToolResult> => {
      const address = process.env[BRIDGE_ADDR]
      const token = process.env[BRIDGE_TOKEN]
      if (!address || !token) {
        return toolError('MarkText bridge is not configured. Set MARKTEXT_BRIDGE_ADDR and MARKTEXT_BRIDGE_TOKEN.')
      }
      try {
        await postReply(address, token, threadId, text)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not connect to the MarkText bridge.'
        return toolError(message)
      }
      return { content: [{ type: 'text', text: 'Reply posted.' }] }
    }
  )
  return server
}

export const startBridgeEntry = async(): Promise<void> => {
  await createReplyMcpServer().connect(new StdioServerTransport())
}

const entryName = path.basename(process.argv[1] ?? '')
if (entryName === 'agentMcpBridge.js' || entryName === 'bridgeEntry.ts') {
  startBridgeEntry().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
