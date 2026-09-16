/**
 * Smoke test for the Cloudflare Worker.
 *   node scripts/smoke.mjs
 *
 * Exits non-zero on failure so CI fails loudly.
 */

import worker from '../port80-worker.js'

const call = (path) => worker.fetch(new Request('https://scanner.local' + path))

let failures = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? `  -> ${extra}` : ''}`)
  if (!cond) failures++
}

console.log('\nvalidation (must reject)')
for (const t of ['', 'http://evil.com/x', '1.2.3.4/../admin', 'a b', 'host?x=1', 'host#frag']) {
  const res = await call('/api/probe?target=' + encodeURIComponent(t))
  const body = await res.json()
  check(`reject ${JSON.stringify(t)}`, res.status === 400 && body.status === 'error')
}

console.log('\nprobe behaviour')

// The live-host assertion needs real outbound HTTP. Some sandboxes block egress
// entirely, so preflight first and skip (rather than fail) when there is no network.
let hasNetwork = false
try {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  await fetch('http://example.com/', { signal: controller.signal, redirect: 'manual' })
  clearTimeout(timer)
  hasNetwork = true
} catch {
  hasNetwork = false
}

if (!hasNetwork) {
  console.log('  SKIP  live host -> no outbound network in this environment')
} else {
  // One retry: a lone timeout is more likely to be egress flake than a real bug.
  let body
  for (let attempt = 0; attempt < 2; attempt++) {
    body = await (await call('/api/probe?target=example.com')).json()
    if (body.reachable) break
  }
  check(
    'live host -> alive',
    body.reachable === true && body.httpStatus > 0,
    JSON.stringify(body),
  )
}

const dead = await call('/api/probe?target=no-such-host-9f8a7b.invalid')
const deadBody = await dead.json()
check('dead host -> not reachable', deadBody.reachable === false, JSON.stringify(deadBody))

console.log('\nui + routing')
const home = await call('/')
const ctype = home.headers.get('content-type') ?? ''
check('GET / serves html', home.status === 200 && ctype.includes('text/html'), ctype)
const html = await home.text()
check('html has app markup', html.includes('port80 scanner') && html.includes('/api/probe'))
check('html has no unresolved template syntax', !html.includes('${'))
check('unknown path -> 404', (await call('/nope')).status === 404)

console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} check(s) FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
