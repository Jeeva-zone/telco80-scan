<div align="center">

# 🔌 telco80-scan

**Port-80 reachability scanner as a single edge function.**
Checks whether a host answers on port 80 and reads its real HTTP status line.
Zero dependencies · zero build step · runs on Cloudflare, Vercel or Netlify.

### 🧪 Build & quality

[![CI](https://github.com/Jeeva-zone/telco80-scan/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeeva-zone/telco80-scan/actions/workflows/ci.yml)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Jeeva-zone/telco80-scan/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Jeeva-zone/telco80-scan/actions/workflows/ci.yml)
[![Last Commit](https://img.shields.io/github/last-commit/Jeeva-zone/telco80-scan?style=for-the-badge&logo=github&logoColor=white&color=blue)](https://github.com/Jeeva-zone/telco80-scan/commits/main)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=for-the-badge&logo=npm&logoColor=white)](package.json)
[![Open Issues](https://img.shields.io/github/issues/Jeeva-zone/telco80-scan?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Jeeva-zone/telco80-scan/issues)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)

### 🧱 Stack

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Vercel Edge](https://img.shields.io/badge/Vercel%20Edge-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/docs/functions/runtimes/edge)
[![Netlify Edge](https://img.shields.io/badge/Netlify%20Edge-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://docs.netlify.com/edge-functions/overview/)
[![JavaScript ESM](https://img.shields.io/badge/JavaScript%20ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Edge Runtime](https://img.shields.io/badge/runtime-edge-blueviolet?style=for-the-badge)](https://workers.cloudflare.com/)
[![Scans Port 80](https://img.shields.io/badge/scans-port%2080-important?style=for-the-badge)](https://en.wikipedia.org/wiki/Port_(computer_networking))

### 🌟 Community

[![Stars](https://img.shields.io/github/stars/Jeeva-zone/telco80-scan?style=for-the-badge&color=yellow&logo=github)](https://github.com/Jeeva-zone/telco80-scan/stargazers)
[![Forks](https://img.shields.io/github/forks/Jeeva-zone/telco80-scan?style=for-the-badge&color=orange&logo=github)](https://github.com/Jeeva-zone/telco80-scan/network/members)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Jeeva-zone/telco80-scan/pulls)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge)](https://github.com/Jeeva-zone)

</div>

---

## 🚀 One-click deploy

| Platform | Button | What gets deployed |
|:---|:---|:---|
| **Cloudflare Workers** | [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jeeva-zone/telco80-scan) | `port80-worker.js` — UI **and** API in one Worker. ⚡ Recommended |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Jeeva-zone/telco80-scan) | Static UI from `public/` + `api/probe.js` Edge Function |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Jeeva-zone/telco80-scan) | Static UI from `public/` + `netlify/edge-functions/probe.js` |

> 💡 **Why three copies of the probe logic?** Each platform's edge runtime exposes a
> different module contract — Cloudflare wants `export default { fetch(){} }`, Vercel wants
> `export default function handler()`, Netlify wants a Deno-style `export default async ()`.
> The logic is ~60 lines and dependency-free, so each target stays a self-contained,
> paste-and-run file rather than depending on a shared module that only one platform can resolve.

---

## ✨ What it does

Sends one `GET /` to `http://<target>:80/` from the edge and reports what came back.

- 🎯 **Manual mode** — type a host or IP, get an instant verdict plus the real status line
- 📋 **Sample Test mode** — loads a host list, probes each entry 5× for accuracy, shows `3/5` style scores
- 🌐 **Online mode** — server-side probe, reads the actual `HTTP 200 OK` line ✅ accurate
- 📴 **Offline mode** — on-device `no-cors` probe when your server is unreachable (verdict only, no status line)

**Any HTTP response at all counts as alive** — even a `400` or `403` proves port 80 is open and
something is listening. A dead port gives `timeout` or `error`.

---

## ⚡ Quick start (local)

```bash
git clone https://github.com/Jeeva-zone/telco80-scan.git
cd telco80-scan

npx wrangler dev port80-worker.js     # http://localhost:8787
npm run smoke                          # run the test suite
```

No `npm install` needed — there are no dependencies.

---

## 📡 API reference

### `GET /api/probe?target=<host>`

| Param | Required | Notes |
|:---|:---|:---|
| `target` | ✅ | Hostname, IPv4 or IPv6. **No scheme, path, port or query** — port is fixed to 80. |

**✅ Reachable (any HTTP response):**

```bash
curl 'https://your-worker.workers.dev/api/probe?target=example.com'
```

```json
{
  "status": "alive",
  "reachable": true,
  "httpStatus": 200,
  "statusText": "OK",
  "line": "ALIVE - HTTP 200 OK",
  "ms": 185
}
```

**❌ Not reachable:**

```json
{ "status": "error", "reachable": false, "message": "Connection failed", "ms": 92 }
```

**⏱️ Timed out (5s, nothing came back):**

```json
{ "status": "timeout", "reachable": false, "message": "No response (timeout)", "ms": 5008 }
```

**🚫 Rejected target — `400`:**

```json
{ "status": "error", "reachable": false, "message": "Invalid target" }
```

### Status values

| `status` | `reachable` | Meaning |
|:---|:---|:---|
| `alive` | `true` | Got an HTTP response — port 80 is open 🎉 |
| `timeout` | `false` | Nothing answered within 5s ⏱️ |
| `error` | `false` | Connection refused / DNS failure 🔌 |
| `error` (400) | `false` | Target failed validation 🚫 |

Responses carry `access-control-allow-origin: *`, so you can call the API from anywhere.

---

## 🧱 Project structure

```
telco80-scan/
├── port80-worker.js               # ⚡ Cloudflare Worker — UI + API, self-contained
├── wrangler.toml                  # Worker config (name, entry point)
├── public/
│   └── index.html                 # 🖥️ Standalone UI for Vercel / Netlify / any static host
├── api/
│   └── probe.js                   # ▲ Vercel Edge Function
├── netlify/
│   └── edge-functions/
│       └── probe.js               # ◆ Netlify Edge Function
├── netlify.toml                   # Netlify publish dir + edge route mapping
├── scripts/
│   └── smoke.mjs                  # 🧪 Validation + probe tests
├── .github/workflows/ci.yml       # 🔄 Syntax check + smoke test on push/PR
├── nextjs-original/               # 📦 The original Next.js 16 app (v0-generated)
├── package.json                   # ESM marker + dev/deploy scripts
├── LICENSE                        # MIT
└── README.md
```

---

## 🛠 Platform notes

<details>
<summary><b>🟠 Cloudflare Workers</b> (recommended)</summary>

One-click button, or:

```bash
npx wrangler deploy port80-worker.js
```

Cloudflare permits outbound fetches on port 80, so this works out of the box. You can also
paste `port80-worker.js` straight into the dashboard: **Workers & Pages → Create → Hello World
→ Quick edit**.

</details>

<details>
<summary><b>▲ Vercel</b></summary>

The button imports the repo with zero config. Vercel serves `public/index.html` at `/` and
`api/probe.js` at `/api/probe` (`export const config = { runtime: 'edge' }` keeps it on the
edge runtime — don't remove it).

</details>

<details>
<summary><b>◆ Netlify</b></summary>

`netlify.toml` sets `publish = "public"` and maps `/api/probe` to the `probe` edge function.
No build command is needed.

</details>

<details>
<summary><b>🧩 Any static host (GitHub Pages, S3, nginx…)</b></summary>

Upload `public/index.html`. It works, but only in **offline** mode — there'd be no server-side
`/api/probe` behind it, so the UI falls back to the browser probe.

</details>

---

## 🔒 Security — read this before going public

The probe endpoint is, by design, a **server that fetches any host you name on port 80**. That's
the whole feature, and it's also a classic SSRF shape. Current protections:

- 🚫 Input allowlist — only `[a-zA-Z0-9.:_-]`, max 255 chars, rejects `/ \ ? # @` and whitespace
- 🔒 No scheme, path, query or port can be injected — the port is hardcoded to 80
- ⏱️ 5-second hard timeout, one request per call, redirects not followed
- 🧾 Only the status code and status text are returned, never the response body

**Not protected:** internal/private IPs (e.g. `127.0.0.1`, `10.0.0.1`, `169.254.169.254`).
If you expose this publicly, consider adding an allowlist, a shared-secret header, or a rate
limit. On Cloudflare, [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
or a WAF rate-limit rule is the quickest win.

---

## ⚠️ Known limitations

- **Port 80 only.** Cloudflare and most edge runtimes restrict outbound ports; 80 and 443 are the
  safe ones. This tool deliberately checks 80.
- **Offline mode over HTTPS is unreliable.** Browsers block `http://` requests from an HTTPS page as
  mixed content, so device probes may report NOT REACHABLE for hosts that are alive. Use online mode.
- **Bracketed IPv6 is rejected.** Use bare `2001:db8::1` rather than `[2001:db8::1]`.
- **One probe = one verdict.** No retries, no TCP ping — it's a plain HTTP GET.

---

## 🧬 Relationship to `nextjs-original/`

This started as **sivdip**, a v0-generated Next.js 16 app (`app/api/probe/route.ts` +
`components/scanner.tsx`). The Worker is a faithful port: same validation regex, same 5s
timeout, same JSON response shape. The original is kept under `nextjs-original/` for reference.

Two bugs from the original are fixed here:

| Bug | Effect |
|:---|:---|
| `loadList(true)` was never defined | 🐛 The **Update** button threw on click |
| `runTest()` called `probe(target, TIMEOUT_MS)` without `mode` | 🐛 Sample Test always fell back to the device probe, ignoring the online/offline toggle |

---

## 🤝 Contributing

```bash
npm run smoke    # must pass before opening a PR
```

PRs welcome — keep it dependency-free and make sure `scripts/smoke.mjs` stays green. 🔄

---

## 📄 License

[MIT](LICENSE) © 2026 Jeeva-zone

---

<div align="center">

Built for checking whether port 80 is actually answering. 🔌

</div>
