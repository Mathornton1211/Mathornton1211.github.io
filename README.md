# mathornton1211.github.io

My portfolio. It's a static site with two working AI features:

- **Ask about my work:** a tool-using agent (Llama 3.3 70B on Cloudflare Workers AI) on the home page. It answers from structured data about my projects and experience, and every tool call is shown as it happens.
- **Job-fit demo:** paste a job description and get an honest fit report (matches with evidence, plus gaps) and a resume reordered for that role. There's also a one-click saved example.

How it's built and guarded: [work/this-site.html](work/this-site.html).

## Layout

```
index.html, resume.html, tailor.html, work/*.html   static pages (GitHub Pages)
resume.pdf                                          generated from resume.html
assets/                                             CSS, chat widget, resume renderer, API config, recorded examples
data/profile.json                                   single source of truth for every fact on the site
worker/                                             Cloudflare Worker: /chat (SSE agent) and /tailor (JSON-schema output)
```

Edit `data/profile.json` and the agent, the tailor and the resume page all pick it up. Then regenerate `resume.pdf`:

```bash
chrome --headless=new --no-pdf-header-footer --virtual-time-budget=5000 --print-to-pdf=resume.pdf http://127.0.0.1:8080/resume.html
```

## Run locally

```bash
cd worker && npm install
npx wrangler dev --port 8787 --var MOCK:1   # offline mock; without MOCK it uses Workers AI (needs wrangler login)
npx http-server .. -p 8080 -c-1             # in another terminal, then open http://localhost:8080
```

## Deploy

1. **Worker.** Use a Cloudflare account on the Workers **Free** plan (no card needed):
   ```bash
   cd worker
   npx wrangler login
   npx wrangler kv namespace create RATE      # optional per-IP limit: paste the id into wrangler.toml
   npx wrangler deploy                        # prints https://portfolio-agent.<you>.workers.dev
   ```
2. Put that URL in `assets/config.js`.
3. **Site:** push to `main` of the `Mathornton1211.github.io` repo, then enable Pages (Settings → Pages → deploy from branch `main`, root).

## Cost: $0, structurally

The model runs on Workers AI's free daily allowance (10,000 neurons a day). On the Workers Free plan there's no billing: once the allowance is used up, calls fail and the site replays recorded examples (`assets/recorded.json`, `assets/sample-tailor.json`). Keep the account on the Free plan; upgrading to Workers Paid would turn on pay-per-use.

## Evals

`evals/cases.json` holds 36 cases (grounding, hallucination traps, prompt injection, reasoning), scored deterministically with regex and tool-call checks. `evals.html` publishes every answer.

```bash
node evals/run.mjs --url https://portfolio-agent.<you>.workers.dev   # writes evals/results.json
```
