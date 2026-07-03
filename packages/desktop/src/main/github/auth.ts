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

/**
 * Read the stored GitHub access token from the OS keychain.
 *
 * @returns The token, or null if the user is not signed in.
 */
export const getToken = (): Promise<string | null> =>
  keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)

/**
 * Persist the (non-secret) GitHub identity so commit — a purely local
 * operation — and the signed-in display work offline and across restarts
 * without a network round-trip.
 *
 * @param identity - Profile fields captured at sign-in.
 */
export const saveIdentity = (identity: StoredIdentity): Promise<void> =>
  keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY, JSON.stringify(identity))

/**
 * Read the persisted GitHub identity.
 *
 * @returns The stored identity, or null if absent or unparseable.
 */
export const loadIdentity = async(): Promise<StoredIdentity | null> => {
  const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredIdentity
  } catch {
    return null
  }
}

/**
 * Sign out locally by clearing the token and identity from the keychain.
 *
 * Note: this does not revoke the token server-side — device-flow apps cannot
 * revoke (that requires the client secret). The token stays valid until the
 * user revokes the app in their GitHub settings.
 */
export const signOut = async(): Promise<void> => {
  // Cancel any in-flight device-flow poll: a late authorization must not
  // write a fresh token and silently re-sign the user in after sign-out.
  pollGeneration++
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
}

/**
 * Begin the OAuth Device Flow by requesting a device + user code.
 *
 * Fails fast with an actionable message when no client id is configured,
 * instead of surfacing a confusing 404 from GitHub.
 *
 * @returns The device code, the user-facing code, the verification URI, and
 *   the poll interval/expiry to drive {@link pollForToken}.
 * @throws If no client id is set, or the request fails.
 */
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

// Starting a new poll cancels any in-flight one — clicking "Sign in" twice
// must not leave two pollers racing to write the token.
let pollGeneration = 0

/**
 * Poll the token endpoint until the user authorizes the device code, honoring
 * GitHub's `slow_down` back-off. On success the token is written to the
 * keychain and returned. Starting a newer poll cancels this one.
 *
 * @param deviceCode - The `deviceCode` from {@link requestDeviceCode}.
 * @param intervalSeconds - Initial poll interval from `requestDeviceCode`.
 * @returns The access token once authorization completes.
 * @throws If the code expires, is denied, or a newer sign-in supersedes this poll.
 */
export const pollForToken = async(deviceCode: string, intervalSeconds: number): Promise<string> => {
  const generation = ++pollGeneration
  let interval = intervalSeconds

  while (true) {
    await sleep(interval * 1000)
    if (generation !== pollGeneration) throw new Error('GitHub sign-in polling was cancelled')
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
