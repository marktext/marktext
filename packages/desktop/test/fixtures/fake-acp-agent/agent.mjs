#!/usr/bin/env node
/**
 * Scripted ACP agent. `FAKE_ACP_SCENARIO` is a JSON file of initialize
 * capabilities, models, and prompt steps. Without it, `FAKE_ACP_MODE` selects
 * the built-in behaviours the older specs still use.
 * `FAKE_ACP_MODELS` is `id:Label,id:Label` for the model catalog.
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const mode = process.env.FAKE_ACP_MODE || 'happy'
const logPath = process.env.FAKE_ACP_LOG
const root = process.env.FAKE_ACP_CWD || process.cwd()
const filePath = path.join(root, 'docs', 'guide.md')

const loadScenario = () => {
  const file = process.env.FAKE_ACP_SCENARIO
  if (!file) return null
  const full = path.isAbsolute(file) ? file : path.resolve(file)
  return JSON.parse(readFileSync(full, 'utf8'))
}

const scenario = loadScenario()

const note = (event) => {
  if (logPath) appendFileSync(logPath, `${JSON.stringify(event)}\n`)
}

note({ event: 'start', mode: scenario ? 'scenario' : mode })

if (mode === 'ignore-term' || scenario?.ignoreSigterm) {
  process.on('SIGTERM', () => {
    note({ event: 'sigterm' })
  })
}

const send = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const reply = (id, result) => {
  send({ jsonrpc: '2.0', id, result })
}

const fail = (id, code, message) => {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

const update = (sessionId, body) => {
  send({
    jsonrpc: '2.0',
    method: 'session/update',
    params: { sessionId, update: body }
  })
}

let authed = false
let sessions = 0
let promptId = null
let mcpServers = []
const permissionWaiters = new Map()

const callReplyTool = (threadId, text) => new Promise((resolve, reject) => {
  const server = mcpServers[0]
  if (!server?.command) {
    reject(new Error('no mcp server'))
    return
  }
  const env = { ...process.env }
  for (const item of server.env ?? []) env[item.name] = item.value
  const child = spawn(server.command, server.args ?? [], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  let buffer = ''
  let stderr = ''
  const pending = new Map()
  let settled = false
  const finish = (error, result) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    child.kill()
    if (error) reject(error)
    else resolve(result)
  }
  const timer = setTimeout(() => {
    finish(new Error(`mcp bridge timed out: ${stderr}`))
  }, 10_000)
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  child.on('error', (error) => finish(error))
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
      if (!line.trim()) continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      const resolveLine = pending.get(message.id)
      if (message.id != null && resolveLine) {
        pending.delete(message.id)
        resolveLine(message)
      }
    }
  })
  const request = (id, method, params) => new Promise((resolveLine) => {
    pending.set(id, resolveLine)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
  request(1, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'fake-acp', version: '1.2.3' }
  }).then((initialized) => {
    if (initialized.error) {
      finish(new Error(initialized.error.message ?? 'initialize failed'))
      return
    }
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
    return request(2, 'tools/call', {
      name: 'reply_to_thread',
      arguments: { threadId, text }
    })
  }).then((called) => {
    if (!called || settled) return
    note({ event: 'mcp-reply', result: called.result ?? null, error: called.error ?? null })
    finish(null, called)
  }).catch((error) => finish(error))
})

const scenarioCapabilities = (spec) => {
  const caps = spec.capabilities ?? {}
  const sessionCapabilities = {}
  if (caps.resume !== false) sessionCapabilities.resume = {}
  if (caps.close !== false) sessionCapabilities.close = {}
  const result = {
    loadSession: caps.loadSession !== false,
    sessionCapabilities
  }
  if (caps.mcpCapabilities !== undefined) result.mcpCapabilities = caps.mcpCapabilities
  return result
}

const capabilities = () => {
  if (scenario) return scenarioCapabilities(scenario)
  if (mode === 'no-resume') return { loadSession: false, sessionCapabilities: {} }
  if (mode === 'load-only') return { loadSession: true, sessionCapabilities: {} }
  if (mode === 'no-close') return { loadSession: true, sessionCapabilities: { resume: {} } }
  return { loadSession: true, sessionCapabilities: { resume: {}, close: {} } }
}

const modelOptions = () => {
  if (scenario && Array.isArray(scenario.models)) {
    return scenario.models.map((model) => ({
      value: model.id,
      name: model.label || model.id
    }))
  }
  if (mode === 'no-models') return []
  const raw = process.env.FAKE_ACP_MODELS
  if (!raw) {
    return [
      { value: 'alpha', name: 'Alpha' },
      { value: 'beta', name: 'Beta' }
    ]
  }
  return raw.split(',').filter(Boolean).map((pair) => {
    const splitAt = pair.indexOf(':')
    const value = splitAt === -1 ? pair : pair.slice(0, splitAt)
    const name = splitAt === -1 ? pair : pair.slice(splitAt + 1)
    return { value, name: name || value }
  })
}

const sessionResult = (method, params) => {
  sessions += 1
  const sessionId = method === 'session/new' ? `sess-${sessions}` : params.sessionId
  const options = modelOptions()
  return {
    sessionId,
    configOptions: options.length === 0
      ? []
      : [{
          id: 'model',
          name: 'Model',
          category: 'model',
          type: 'select',
          currentValue: options[0].value,
          options
        }]
  }
}

const askPermission = (sessionId, step) => new Promise((resolve) => {
  const id = sessions + 100
  permissionWaiters.set(id, resolve)
  send({
    jsonrpc: '2.0',
    id,
    method: 'session/request_permission',
    params: {
      sessionId,
      toolCall: {
        toolCallId: step?.toolCallId ?? 'tool-1',
        title: step?.title ?? 'Run tests',
        kind: step?.kind ?? 'execute'
      },
      options: step?.options ?? [
        { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'reject-once', name: 'Reject once', kind: 'reject_once' }
      ]
    }
  })
})

const agentText = (sessionId, messageId, text) => {
  update(sessionId, {
    sessionUpdate: 'agent_message_chunk',
    messageId,
    content: { type: 'text', text }
  })
}

const runSteps = async (promptRpcId, sessionId, steps) => {
  let written = null
  const run = async (list) => {
    for (const step of list ?? []) {
      if (step.type === 'delay') {
        const ms = step.env ? Number(process.env[step.env] || 0) : Number(step.ms || 0)
        if (ms > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
        continue
      }
      if (step.type === 'write_env') {
        written = writeRequested()
        continue
      }
      if (step.type === 'write') {
        const target = path.resolve(root, step.path)
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, step.body ?? '')
        written = target
        continue
      }
      if (step.type === 'tool_call') {
        const loc = step.location === '$written' ? written : step.location
        if (step.location === '$written' && !loc) continue
        const locations = loc
          ? [{ path: loc }]
          : (step.locations ?? []).map((item) => ({ path: path.resolve(root, item) }))
        update(sessionId, {
          sessionUpdate: 'tool_call',
          toolCallId: step.toolCallId ?? 'tool-1',
          title: step.title ?? 'Edit',
          status: step.status ?? 'completed',
          kind: step.kind ?? 'edit',
          locations
        })
        continue
      }
      if (step.type === 'tool_call_update') {
        update(sessionId, {
          sessionUpdate: 'tool_call_update',
          toolCallId: step.toolCallId ?? 'tool-1',
          title: step.title ?? 'Edit',
          status: step.status ?? 'completed',
          kind: step.kind ?? 'edit',
          content: step.diffPath
            ? [{ type: 'diff', path: path.resolve(root, step.diffPath), oldText: 'a', newText: 'b' }]
            : []
        })
        continue
      }
      if (step.type === 'message_chunk') {
        agentText(sessionId, step.messageId ?? 'agent-1', step.text ?? '')
        continue
      }
      if (step.type === 'thought_chunk') {
        update(sessionId, {
          sessionUpdate: 'agent_thought_chunk',
          messageId: step.messageId ?? 'thought-1',
          content: { type: 'text', text: step.text ?? '' }
        })
        continue
      }
      if (step.type === 'plan') {
        update(sessionId, {
          sessionUpdate: 'plan',
          entries: [{ content: step.text ?? '', priority: 'high', status: 'pending' }]
        })
        continue
      }
      if (step.type === 'permission') {
        const outcome = await askPermission(sessionId, step)
        note({ event: 'permission-outcome', outcome: outcome?.outcome ?? outcome })
        const selected = outcome?.outcome?.optionId
        const cancelled = outcome?.outcome?.outcome === 'cancelled'
        const branch = cancelled ? step.branches?.cancelled : step.branches?.[selected]
        if (branch === 'cancel' || cancelled) {
          reply(promptRpcId, { stopReason: 'cancelled' })
          return 'stop'
        }
        if (Array.isArray(branch)) {
          const nested = await run(branch)
          if (nested === 'stop') return 'stop'
        }
        continue
      }
      if (step.type === 'mcp_reply') {
        const threadId = step.env ? process.env[step.env] : step.threadId
        const text = step.textEnv ? (process.env[step.textEnv] ?? '') : (step.text ?? '')
        if (!threadId) {
          fail(promptRpcId, -32602, 'FAKE_ACP_REPLY_THREAD is required')
          return 'stop'
        }
        await callReplyTool(threadId, text)
        continue
      }
      if (step.type === 'replies_block') {
        const raw = step.env ? process.env[step.env] : ''
        if (!raw && !step.replies) {
          agentText(sessionId, 'agent-1', 'done')
          continue
        }
        const replies = raw ? JSON.parse(raw) : step.replies
        agentText(sessionId, step.messageId ?? 'agent-1', `\`\`\`marktext-replies\n${JSON.stringify(replies)}\n\`\`\``)
        continue
      }
      if (step.type === 'crash') process.exit(1)
      if (step.type === 'wait_cancel') {
        promptId = promptRpcId
        return 'stop'
      }
    }
    return 'continue'
  }
  const result = await run(steps)
  if (result !== 'stop') reply(promptRpcId, { stopReason: 'end_turn' })
}

const writeRequested = () => {
  const rel = process.env.FAKE_ACP_WRITE
  if (!rel) return null
  const target = path.resolve(root, rel)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, process.env.FAKE_ACP_WRITE_BODY ?? 'edited\n')
  return target
}

const happyUpdates = (sessionId) => {
  update(sessionId, {
    sessionUpdate: 'agent_message_chunk',
    messageId: 'agent-1',
    content: { type: 'text', text: 'hello' }
  })
  update(sessionId, {
    sessionUpdate: 'agent_thought_chunk',
    messageId: 'thought-1',
    content: { type: 'text', text: 'checking' }
  })
  update(sessionId, {
    sessionUpdate: 'plan',
    entries: [{ content: 'Read the file', priority: 'high', status: 'pending' }]
  })
  update(sessionId, {
    sessionUpdate: 'tool_call',
    toolCallId: 'tool-1',
    title: 'Edit guide',
    status: 'in_progress',
    kind: 'edit',
    locations: [{ path: filePath }]
  })
  update(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId: 'tool-1',
    title: 'Edit guide',
    status: 'completed',
    kind: 'edit',
    content: [{ type: 'diff', path: filePath, oldText: 'a', newText: 'b' }]
  })
  update(sessionId, {
    sessionUpdate: 'notice',
    severity: 'info',
    title: 'heads up'
  })
}

const handle = async (message) => {
  const { id, method, params } = message
  if (method === 'initialize') {
    const capabilitiesSent = params?.clientCapabilities ?? {}
    if (capabilitiesSent.fs || capabilitiesSent.terminal) {
      fail(id, -32602, 'client capabilities must be empty')
      return
    }
    const result = {
      protocolVersion: params.protocolVersion,
      agentInfo: { name: 'fake-acp', version: '1.2.3' },
      agentCapabilities: capabilities()
    }
    if (mode === 'auth' || mode === 'auth-fail') {
      result.authMethods = [{ id: 'cursor_login', name: 'Login', description: 'agent login' }]
    }
    reply(id, result)
    return
  }
  if (method === 'authenticate') {
    if (mode === 'auth-fail' || params?.methodId !== 'cursor_login') {
      fail(id, -32000, 'Authentication required')
      return
    }
    authed = true
    reply(id, {})
    return
  }
  if (method === 'session/new' || method === 'session/load' || method === 'session/resume') {
    if ((mode === 'auth' || mode === 'auth-fail') && method === 'session/new' && !authed) {
      fail(id, -32000, 'Authentication required')
      return
    }
    if (method === 'session/new') mcpServers = params?.mcpServers ?? []
    reply(id, sessionResult(method, params ?? {}))
    return
  }
  if (method === 'session/set_config_option') {
    reply(id, { configOptions: [] })
    return
  }
  if (method === 'session/close') {
    reply(id, {})
    return
  }
  if (method === 'session/prompt') {
    const sessionId = params.sessionId
    if (scenario) {
      await runSteps(id, sessionId, scenario.steps ?? [])
      return
    }
    if (mode === 'crash') {
      update(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'agent-1',
        content: { type: 'text', text: 'partial' }
      })
      process.exit(1)
    }
    if (mode === 'cancel') {
      promptId = id
      writeRequested()
      update(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'agent-1',
        content: { type: 'text', text: 'working' }
      })
      return
    }
    if (mode === 'turn') {
      const delay = Number(process.env.FAKE_ACP_DELAY_MS || 0)
      if (delay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delay))
      const written = writeRequested()
      if (written) {
        update(sessionId, {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-1',
          title: 'Edit',
          status: 'completed',
          kind: 'edit',
          locations: [{ path: written }]
        })
      }
      const block = process.env.FAKE_ACP_BLOCK
      const text = block ? `\`\`\`marktext-replies\n${block}\n\`\`\`` : 'done'
      update(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'agent-1',
        content: { type: 'text', text }
      })
      reply(id, { stopReason: 'end_turn' })
      return
    }
    if (mode === 'mcp-reply') {
      const threadId = process.env.FAKE_ACP_REPLY_THREAD
      const text = process.env.FAKE_ACP_REPLY_TEXT ?? ''
      if (!threadId) {
        fail(id, -32602, 'FAKE_ACP_REPLY_THREAD is required')
        return
      }
      await callReplyTool(threadId, text)
      update(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'agent-1',
        content: { type: 'text', text: 'replied' }
      })
      reply(id, { stopReason: 'end_turn' })
      return
    }
    if (mode === 'permission') {
      const outcome = await askPermission(sessionId)
      note({ event: 'permission-outcome', outcome: outcome?.outcome ?? outcome })
      const cancelled = outcome?.outcome?.outcome === 'cancelled'
      reply(id, { stopReason: cancelled ? 'cancelled' : 'end_turn' })
      return
    }
    happyUpdates(sessionId)
    reply(id, { stopReason: 'end_turn' })
  }
}

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }
  note({
    event: message.method ? 'inbound' : 'response',
    method: message.method ?? null,
    id: message.id ?? null,
    params: message.params ?? null
  })
  if (message.method == null && message.id != null) {
    const resolve = permissionWaiters.get(message.id)
    if (resolve) {
      permissionWaiters.delete(message.id)
      resolve(message.result ?? message.error)
    }
    return
  }
  if (message.method === 'session/cancel' && promptId != null) {
    const id = promptId
    promptId = null
    reply(id, { stopReason: 'cancelled' })
    return
  }
  if (message.id == null || message.method == null) return
  handle(message).catch((error) => {
    fail(message.id, -32603, error instanceof Error ? error.message : String(error))
  })
})
