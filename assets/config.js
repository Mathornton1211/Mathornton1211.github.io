// Where the portfolio agent (worker/) is running.
// Deployed from worker/ with `wrangler deploy`.
window.AGENT_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://127.0.0.1:8787"
  : "https://portfolio-agent.mathew-thornton.workers.dev";
