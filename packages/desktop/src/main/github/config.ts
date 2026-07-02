// OAuth Device Flow + git constants for the GitHub integration.
// The client_id is public (device flow needs no secret); ship it in source.
// Override with MARKTEXT_GITHUB_CLIENT_ID for local development against a
// throwaway OAuth App.
export const GITHUB_CLIENT_ID = process.env.MARKTEXT_GITHUB_CLIENT_ID || ''

// Read at call time so a client id supplied via the environment (dev) is
// picked up without re-evaluating a module const, and so the "not configured"
// guard reflects the live value.
export const getClientId = (): string => process.env.MARKTEXT_GITHUB_CLIENT_ID || GITHUB_CLIENT_ID

export const GITHUB_OAUTH_SCOPE = 'repo'

// keytar storage coordinates for the access token and the (non-secret)
// user identity persisted for offline commits / signed-in display.
export const KEYTAR_SERVICE = 'marktext-github'
export const KEYTAR_ACCOUNT = 'oauth-token'
export const KEYTAR_ACCOUNT_IDENTITY = 'user-identity'

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_API_BASE = 'https://api.github.com'
export const GITHUB_VERIFICATION_URI = 'https://github.com/login/device'
