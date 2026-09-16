/**
 * Vercel Edge Function — /api/probe
 *
 * Same contract as the Cloudflare Worker and the Netlify Edge Function.
 * The UI (public/index.html) is served statically and calls this route.
 */

export const config = { runtime: 'edge' }

const TIMEOUT_MS = 5000

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  })
}

// Only allow plain host / IPv4 / IPv6 / hostname tokens. No scheme, path, port
// or query — the port is fixed to 80 on the server side.
function isValidTarget(target) {
  if (!target || target.length > 255) return false
  if (/[/\\?#@\s]/.test(target)) return false
  return /^[a-zA-Z0-9.:_-]+$/.test(target)
}

export default async function handler(request) {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const target = (url.searchParams.get('target') ?? '').trim()
  if (!isValidTarget(target)) {
    return json({ status: 'error', reachable: false, message: 'Invalid target' }, 400)
  }

  // Bracket IPv6 literals for the URL.
  const host = target.includes(':') && !target.startsWith('[') ? `[${target}]` : target

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  try {
    const res = await fetch(`http://${host}:80/`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'port80-scanner/1.0 (vercel-edge)',
        accept: '*/*',
      },
    })
    clearTimeout(timer)
    const ms = Date.now() - start

    return json({
      status: 'alive',
      reachable: true,
      httpStatus: res.status,
      statusText: res.statusText,
      line: `ALIVE - HTTP ${res.status} ${res.statusText}`.trim(),
      ms,
    })
  } catch (err) {
    clearTimeout(timer)
    const ms = Date.now() - start
    const aborted = controller.signal.aborted
    return json({
      status: aborted ? 'timeout' : 'error',
      reachable: false,
      message: aborted ? 'No response (timeout)' : err?.message ?? 'Connection failed',
      ms,
    })
  }
}
