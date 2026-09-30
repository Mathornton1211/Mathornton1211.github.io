// Runs evals/cases.json against the portfolio agent's /chat endpoint and
// writes evals/results.json, which evals.html renders.
//
//   node evals/run.mjs --url https://portfolio-agent.<you>.workers.dev
//   node evals/run.mjs --url http://127.0.0.1:8787 --out evals/results.local.json --only trap-
//
// Scoring is deterministic (regex and tool checks), so a rerun on the same
// answers gives the same score. Each case runs once; the model is sampled, so
// expect a point or two of run-to-run variance.

import { readFile, writeFile } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const URL_BASE = (args.url || "http://127.0.0.1:8787").replace(/\/$/, "");
const OUT = args.out || "evals/results.json";
const ONLY = args.only || "";
const CONCURRENCY = Number(args.concurrency || 2);
const ORIGIN = args.origin || "http://localhost:8080";

const { cases } = JSON.parse(await readFile(new URL("./cases.json", import.meta.url), "utf8"));
const selected = cases.filter((c) => c.id.startsWith(ONLY));

async function ask(question) {
  const t0 = Date.now();
  const res = await fetch(URL_BASE + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(process.env.EVAL_TOKEN ? { "x-eval-token": process.env.EVAL_TOKEN } : {}) },
    body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const raw = await res.text();
  const tools = [];
  let text = "";
  let unavailable = false;
  for (const block of raw.split("\n\n")) {
    const line = block.replace(/^data: /, "").trim();
    if (!line) continue;
    const e = JSON.parse(line);
    if (e.type === "tool") tools.push({ name: e.name, input: e.input });
    else if (e.type === "text") text += e.delta;
    else if (e.type === "unavailable") unavailable = true;
  }
  return { tools, text, unavailable, ms: Date.now() - t0 };
}

function score(c, r) {
  const re = (s) => new RegExp(s, "i");
  const checks = [];
  if (c.tools) checks.push({ check: `called one of ${c.tools.join(", ")}`, pass: r.tools.some((t) => c.tools.includes(t.name)) });
  for (const s of c.all ?? []) checks.push({ check: `mentions /${s}/`, pass: re(s).test(r.text) });
  if (c.any) checks.push({ check: `mentions one of ${c.any.map((s) => `/${s}/`).join(" ")}`, pass: c.any.some((s) => re(s).test(r.text)) });
  if (c.maxlen) checks.push({ check: `stays under ${c.maxlen} characters`, pass: r.text.length <= c.maxlen });
  for (const s of c.none ?? []) checks.push({ check: `does not say /${s}/`, pass: !re(s).test(r.text) });
  return { pass: checks.every((x) => x.pass), checks };
}

const results = [];
let next = 0;
async function worker() {
  while (next < selected.length) {
    const c = selected[next++];
    try {
      const r = await ask(c.q);
      if (r.unavailable) throw new Error("model unavailable (free allowance used up?)");
      const s = score(c, r);
      results.push({ id: c.id, cat: c.cat, q: c.q, answer: r.text, tools: r.tools, ms: r.ms, ...s });
      console.log(`${s.pass ? "PASS" : "FAIL"}  ${c.id.padEnd(18)} ${r.ms}ms`);
    } catch (err) {
      results.push({ id: c.id, cat: c.cat, q: c.q, error: String(err.message || err), pass: false, checks: [] });
      console.log(`ERR   ${c.id.padEnd(18)} ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
results.sort((a, b) => selected.findIndex((c) => c.id === a.id) - selected.findIndex((c) => c.id === b.id));

const byCat = {};
for (const r of results) {
  byCat[r.cat] ??= { passed: 0, total: 0 };
  byCat[r.cat].total++;
  if (r.pass) byCat[r.cat].passed++;
}
const health = await fetch(URL_BASE + "/health").then((r) => r.json()).catch(() => ({}));
const summary = {
  ran_at: new Date().toISOString(),
  model: health.model ?? "unknown",
  mock: !!health.mock,
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  errors: results.filter((r) => r.error).length,
  median_ms: results.filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b)[Math.floor(results.length / 2)] ?? null,
  by_category: byCat,
};
await writeFile(OUT, JSON.stringify({ summary, results }, null, 2) + "\n");
console.log(`\n${summary.passed}/${summary.total} passed`, byCat, `-> ${OUT}`);
