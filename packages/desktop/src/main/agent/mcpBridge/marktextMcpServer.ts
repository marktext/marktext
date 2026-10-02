import path from 'path'
import { MCP_SERVER_NAME } from '@shared/types/agent'
import type { AcpMcpServer } from '../harness/acpConnection'

export const MARKTEXT_BRIDGE_ADDR = 'MARKTEXT_BRIDGE_ADDR'
export const MARKTEXT_BRIDGE_TOKEN = 'MARKTEXT_BRIDGE_TOKEN'

/**
 * Script the harness spawns. A packaged path is rewritten to `app.asar.unpacked`:
 * `ELECTRON_RUN_AS_NODE` does not read files inside the asar archive.
 */
export const agentMcpBridgeScript = (appPath: string): string =>
  path.join(appPath, 'out', 'main', 'agentMcpBridge.js').replace(/\bapp\.asar\b/, 'app.asar.unpacked')

/** `mcpServers` entry for `session/new` and `session/resume`. */
export const marktextMcpServer = (appPath: string, address: string, token: string): AcpMcpServer => ({
  name: MCP_SERVER_NAME,
  command: process.execPath,
  args: [agentMcpBridgeScript(appPath)],
  env: [
    { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
    { name: MARKTEXT_BRIDGE_ADDR, value: address },
    { name: MARKTEXT_BRIDGE_TOKEN, value: token }
  ]
})
