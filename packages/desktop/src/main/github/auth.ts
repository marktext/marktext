import keytar from 'keytar'
import {
  getClientId,
  GITHUB_OAUTH_SCOPE,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_TOKEN_URL,
  KEYTAR_SERVICE,
  KEYTAR_ACCOUNT,
  KEYTAR_ACCOUNT_IDENTITY
} from './config'

export interface DeviceCodeInfo {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

// The identity is persisted (it is not a secret) so commit — a purely local
// operation — and the signed-in display work offline and across restarts
// without a network round-trip (spec: Commit identity).
export interface StoredIdentity {
  login: string
  name: string | null
  id: number
}

// Provider interface so a PAT provider can be dropped in later (spec: out of
// scope for v1, but the seam exists).
export interface GitHubAuthProvider {
  signIn(): Promise<DeviceCodeInfo>
  getToken(): Promise<string | null>
  signOut(): Promise<void>
}

export const getToken = (): Promise<string | null> =>
  keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)

export const saveIdentity = (identity: StoredIdentity): Promise<void> =>
  keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY, JSON.stringify(identity))

export const loadIdentity = async(): Promise<StoredIdentity | null> => {
  const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredIdentity
  } catch {
    return null
  }
}

export const signOut = async(): Promise<void> => {
  // Local sign-out only: device-flow apps cannot revoke the token
  // server-side (that requires the client secret). Documented in the spec.
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
}

export const requestDeviceCode = async(): Promise<DeviceCodeInfo> => {
  const clientId = getClientId()
  // Fail fast with an actionable message instead of a confusing 404 from
  // GitHub when no OAuth App client id has been configured (spec:
  // Prerequisite / docs/dev/GITHUB_INTEGRATION.md).
  if (!clientId) {
    throw new Error(
      'GitHub sign-in is not configured: set a client id (MARKTEXT_GITHUB_CLIENT_ID)'
    )
  }
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: GITHUB_OAUTH_SCOPE })
  })
  if (!res.ok) throw new Error(`GitHub device code request failed: ${res.status}`)
  const data = await res.json()
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Polls the token endpoint until the user authorizes (or the code expires).
// intervalSeconds comes from requestDeviceCode(); GitHub may ask us to back
// off. Starting a new poll cancels any in-flight one — clicking "Sign in"
// twice must not leave two pollers racing to write the token.
let pollGeneration = 0

export const pollForToken = async(deviceCode: string, intervalSeconds: number): Promise<string> => {
  const generation = ++pollGeneration
  let interval = intervalSeconds

  while (true) {
    await sleep(interval * 1000)
    if (generation !== pollGeneration) throw new Error('Polling cancelled by a newer sign-in')
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getClientId(),
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const data = await res.json()
    if (data.access_token) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, data.access_token)
      return data.access_token
    }
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') {
      interval = (data.interval ?? interval) + 5
      continue
    }
    throw new Error(`GitHub authorization failed: ${data.error ?? 'unknown'}`)
  }
}
