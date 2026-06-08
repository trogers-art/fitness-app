import crypto from 'crypto'

function sign(method: string, url: string, params: Record<string, string>, secret: string): string {
  const normalized = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const base = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(normalized)}`
  return crypto.createHmac('sha1', `${encodeURIComponent(secret)}&`).update(base).digest('base64')
}

export async function fatSecretPOST(methodName: string, extra: Record<string, string>): Promise<any> {
  const key    = process.env.FATSECRET_CONSUMER_KEY?.trim()
  const secret = process.env.FATSECRET_CONSUMER_SECRET?.trim()
  if (!key || !secret) { console.error('[FS] Missing API keys'); return null }

  const url = 'https://platform.fatsecret.com/rest/server.api'

  // Build params WITHOUT signature first
  const params: Record<string, string> = {
    method:                 methodName,
    format:                 'json',
    oauth_consumer_key:     key,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_version:          '1.0',
    ...extra,
  }

  // Sign with all params including method-specific ones
  params.oauth_signature = sign('POST', url, params, secret)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(params).toString(),
    })
    const data = await res.json()
    if (data.error) {
      console.error(`[FS] ${methodName} error:`, data.error)
      return null
    }
    return data
  } catch (e: unknown) {
    console.error(`[FS] ${methodName} request failed:`, e)
    return null
  }
}
