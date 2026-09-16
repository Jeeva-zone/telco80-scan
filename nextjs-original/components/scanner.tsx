'use client'

import { useCallback, useEffect, useState } from 'react'

type Status = 'open' | 'reachable' | 'timeout' | 'error'

type ProbeMode = 'server' | 'device'

type Mode = 'online' | 'offline'

type Result = {
  target: string
  status: Status
  ms: number
  line?: string
  mode?: ProbeMode
}

const TIMEOUT_MS = 3000
const TESTS_PER_IP = 5

// Source is kept out of the UI on purpose.
const LIST_SRC =
  'https://raw.githubusercontent.com/Durgaa17/Raam-Public-Vless/refs/heads/main/scaniplist.txt'
const LIST_CACHE_KEY = 'sample-ip-list-v1'

// SERVER probe — asks our own Route Handler (/api/probe) to do a real GET to
// host:80 and read the actual HTTP status line. This is the accurate path:
//   reachable=true  -> host returned an HTTP response  => "reachable" (+ status line)
//   status=timeout  -> nothing came back before timeout => "timeout"
//   status=error    -> connection refused / DNS failure => "error"
//
// It only works when the device can reach our server (i.e. it has internet).
// Returns null when /api/probe itself is unreachable, so the caller can fall
// back to an on-device probe.
async function serverProbe(
  target: string,
  timeout: number,
): Promise<Omit<Result, 'target'> | null> {
  const start = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout + 2000)

  try {
    const res = await fetch(`/api/probe?target=${encodeURIComponent(target)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = (await res.json()) as {
      status: string
      reachable: boolean
      line?: string
      message?: string
      ms?: number
    }
    const ms = data.ms ?? Math.round(performance.now() - start)
    if (data.reachable) return { status: 'reachable', ms, line: data.line, mode: 'server' }
    return {
      status: data.status === 'timeout' ? 'timeout' : 'error',
      ms,
      line: data.message,
      mode: 'server',
    }
  } catch {
    clearTimeout(timer)
    // Could not reach our own server. If it was our own timeout, treat it as a
    // timeout; otherwise we're offline — signal that with null so we fall back.
    if (controller.signal.aborted) {
      return { status: 'timeout', ms: Math.round(performance.now() - start), mode: 'server' }
    }
    return null
  }
}

// DEVICE probe — runs entirely in the browser with a no-cors fetch to
// http://host:80/. Best-effort verdict only: the browser hands back an opaque
// response, so we can tell "something answered" (resolve => reachable) from
// "nothing answered" (reject => not reachable / timeout), but we can NEVER read
// the real status line here. Used offline, when the server can't be reached.
// Note: an HTTPS-served page blocks http:// as mixed content, so this may
// report NOT REACHABLE even for live hosts — that's a browser limit, not a bug.
async function deviceProbe(
  target: string,
  timeout: number,
): Promise<Omit<Result, 'target'>> {
  const start = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    await fetch(`http://${target}:80/favicon.ico`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return {
      status: 'reachable',
      ms: Math.round(performance.now() - start),
      line: 'Device probe: host responded (status line not readable offline)',
      mode: 'device',
    }
  } catch {
    clearTimeout(timer)
    const ms = Math.round(performance.now() - start)
    return {
      status: controller.signal.aborted ? 'timeout' : 'error',
      ms,
      line: 'Device probe: no response',
      mode: 'device',
    }
  }
}

// Mode is chosen by the user via the header toggle:
//   'online'  -> server probe (real HTTP status line). If our own server can't
//                be reached, fall back to the on-device probe so it still works.
//   'offline' -> on-device ping-style probe only: REACHABLE / NOT REACHABLE for
//                host:80, no status line.
async function probe(
  target: string,
  timeout: number,
  mode: Mode,
): Promise<Omit<Result, 'target'>> {
  if (mode === 'online') {
    const server = await serverProbe(target, timeout)
    if (server) return server
  }
  return deviceProbe(target, timeout)
}

const LABELS: Record<Status, { text: string; className: string }> = {
  open: { text: 'REACHABLE', className: 'text-emerald-500' },
  reachable: { text: 'REACHABLE', className: 'text-emerald-500' },
  timeout: { text: 'NO RESPONSE', className: 'text-muted-foreground' },
  error: { text: 'NOT REACHABLE', className: 'text-destructive' },
}

function parseList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    ),
  )
}

type ManualResult = Result

function ManualTab({ mode }: { mode: Mode }) {
  const [ip, setIp] = useState('')
  const [scanning, setScanning] = useState(false)
  const [log, setLog] = useState<ManualResult[]>([])

  async function scan() {
    const target = ip.trim()
    if (!target || scanning) return
    setScanning(true)
    try {
      const res = await probe(target, TIMEOUT_MS, mode)
      setLog((prev) => [{ target, ...res }, ...prev].slice(0, 50))
    } catch {
      setLog((prev) => [{ target, status: 'error', ms: 0 }, ...prev].slice(0, 50))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) scan()
          }}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="192.168.1.1 or host.example.com"
          aria-label="IP address or hostname"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={scan}
          disabled={scanning || !ip.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      <ul className="mt-6 space-y-1 font-mono text-sm">
        {log.length === 0 && <li className="text-muted-foreground">No scans yet.</li>}
        {log.map((r, i) => {
          const label = LABELS[r.status]
          return (
            <li
              key={`${r.target}-${i}`}
              className="flex flex-col gap-0.5 border-b border-border py-1.5"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate">{r.target}:80</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-foreground">{r.ms}ms</span>
                  <span className={label.className}>{label.text}</span>
                </span>
              </span>
              {r.line && (
                <span className="truncate text-xs text-muted-foreground">{r.line}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type ListState = 'loading' | 'ready' | 'cached' | 'error'

type SampleResult = {
  target: string
  success: number
  total: number
  avgMs: number
}

function SampleTab({ mode }: { mode: Mode }) {
  const [list, setList] = useState<string[]>([])
  const [listState, setListState] = useState<ListState>('loading')
  const [updating, setUpdating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SampleResult[]>([])

  // Fetch the list from the source and cache it. Only runs on first load when
  // there's no cache yet, or when the user presses "Update".
  const fetchFromSource = useCallback(async () => {
    setUpdating(true)
    try {
      const res = await fetch(LIST_SRC, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const parsed = parseList(await res.text())
      setList(parsed)
      setListState('ready')
      try {
        localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(parsed))
      } catch {}
    } catch {
      // No internet — keep whatever we already have (cache), else mark error.
      try {
        const cached = localStorage.getItem(LIST_CACHE_KEY)
        if (cached) {
          setList(JSON.parse(cached))
          setListState('cached')
        } else {
          setListState('error')
        }
      } catch {
        setListState('error')
      }
    } finally {
      setUpdating(false)
    }
  }, [])

  // On mount: use the cached copy if we have one and don't touch the network.
  // Only fetch from source when there's nothing cached yet.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LIST_CACHE_KEY)
      if (cached) {
        setList(JSON.parse(cached))
        setListState('cached')
        return
      }
    } catch {}
    fetchFromSource()
  }, [fetchFromSource])

  async function runTest() {
    if (testing || list.length === 0) return
    setTesting(true)
    setProgress(0)
    setResults([])
    const out: SampleResult[] = []
    for (const target of list) {
      let success = 0
      let msSum = 0
      let msCount = 0
      for (let i = 0; i < TESTS_PER_IP; i++) {
        try {
          const r = await probe(target, TIMEOUT_MS)
          if (r.status === 'open' || r.status === 'reachable') {
            success++
            msSum += r.ms
            msCount++
          }
        } catch {}
      }
      out.push({
        target,
        success,
        total: TESTS_PER_IP,
        avgMs: msCount ? Math.round(msSum / msCount) : 0,
      })
      setProgress(out.length)
      setResults([...out])
    }
    setTesting(false)
  }

  const listReady = listState === 'ready' || listState === 'cached'

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              listReady
                ? 'bg-emerald-500'
                : listState === 'error'
                  ? 'bg-destructive'
                  : 'animate-pulse bg-muted-foreground'
            }`}
            aria-hidden
          />
          <span
            className={
              listReady
                ? 'text-emerald-500'
                : listState === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }
          >
            {listState === 'loading' && 'Loading list…'}
            {listState === 'ready' && `List loaded (${list.length})`}
            {listState === 'cached' && `Cached list (${list.length})`}
            {listState === 'error' && 'List unavailable'}
          </span>
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => loadList(true)}
            disabled={updating || testing}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          >
            {updating ? 'Updating…' : 'Update'}
          </button>
          <button
            onClick={runTest}
            disabled={testing || !listReady || list.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {testing ? `Testing ${progress}/${list.length}` : 'Sample Test'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Each entry is probed on port 80, {TESTS_PER_IP} times, for accuracy.
      </p>

      <ul className="mt-4 space-y-1 font-mono text-sm">
        {results.length === 0 && (
          <li className="text-muted-foreground">
            {testing ? 'Testing…' : 'No results yet.'}
          </li>
        )}
        {results.map((r, i) => {
          const good = r.success > 0
          return (
            <li
              key={`${r.target}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-border py-1.5"
            >
              <span className="truncate">{r.target}:80</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">{good ? `${r.avgMs}ms` : '—'}</span>
                <span className={good ? 'text-emerald-500' : 'text-muted-foreground'}>
                  {r.success}/{r.total}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Scanner() {
  const [tab, setTab] = useState<'manual' | 'sample'>('manual')
  const [mode, setMode] = useState<Mode>('online')
  const online = mode === 'online'

  return (
    <div className="w-full max-w-lg">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-mono text-lg font-semibold">port80 scanner</h1>
          <div
            className="flex gap-1 rounded-md border border-border p-0.5 font-mono text-xs"
            role="group"
            aria-label="Probe mode"
          >
            <button
              onClick={() => setMode('online')}
              aria-pressed={online}
              className={`rounded px-2 py-1 font-medium transition-colors ${
                online
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              online
            </button>
            <button
              onClick={() => setMode('offline')}
              aria-pressed={!online}
              className={`rounded px-2 py-1 font-medium transition-colors ${
                !online
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              offline
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {online
            ? 'Online: server reads the real HTTP status line on port 80.'
            : 'Offline: on-device ping only — REACHABLE / NOT REACHABLE, no status line.'}
        </p>
      </header>

      <div className="mb-6 flex gap-1 rounded-md border border-border p-1">
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setTab('sample')}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'sample'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sample Test
        </button>
      </div>

      {tab === 'manual' ? <ManualTab mode={mode} /> : <SampleTab mode={mode} />}
    </div>
  )
}
