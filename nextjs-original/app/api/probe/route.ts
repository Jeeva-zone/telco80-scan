import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIMEOUT_MS = 5000

// Only allow plain host / IPv4 / IPv6 / hostname tokens. No scheme, path, or
// port — the port is fixed to 80 on the server side.
function isValidTarget(target: string): boolean {
  if (!target || target.length > 255) return false
  if (/[/\\?#@\s]/.test(target)) return false
  return /^[a-zA-Z0-9.:_-]+$/.test(target)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const target = (searchParams.get('target') ?? '').trim()

  if (!isValidTarget(target)) {
    return NextResponse.json(
      { status: 'error', reachable: false, message: 'Invalid target' },
      { status: 400 },
    )
  }

  // Bracket IPv6 literals for the URL.
  const host = target.includes(':') && !target.startsWith('[') ? `[${target}]` : target
  const url = `http://${host}:80/`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'port80-scanner/1.0' },
    })
    clearTimeout(timer)
    const ms = Date.now() - start

    // Any HTTP response at all counts as reachable/alive.
    return NextResponse.json({
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
    return NextResponse.json({
      status: aborted ? 'timeout' : 'error',
      reachable: false,
      message: aborted ? 'No response (timeout)' : (err as Error)?.message ?? 'Connection failed',
      ms,
    })
  }
}
