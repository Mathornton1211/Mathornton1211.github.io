// Chat widget for the portfolio agent. Renders streamed text plus a visible
// trace of every tool call the agent makes.
(function () {
  const root = document.querySelector("[data-agent]");
  if (!root) return;
  const log = root.querySelector(".log");
  const form = root.querySelector("form");
  const input = form.querySelector("input");
  const send = form.querySelector("button");
  const dot = root.querySelector(".dot");
  const statusText = root.querySelector(".status span:last-child");
  const history = [];
  let busy = false;
  let recorded = {};
  fetch(new URL("assets/recorded.json", document.baseURI)).then((r) => r.json()).then((r) => (recorded = r)).catch(() => {});

  // Replays a recorded run (same trace + answer the live agent gave) when the
  // live model is unavailable, e.g. after the free daily allowance is used.
  async function replay(question) {
    const rec = recorded[question];
    if (!rec) {
      add("msg bot err", "The live AI is resting right now (it runs on a free daily allowance). Try one of the suggested questions for a recorded answer, or email mathew.thornton@gmail.com.");
      return;
    }
    add("trace", "recorded example (live AI is resting)");
    for (const [name, input, summary] of rec.trace) {
      const t = trace(name, input);
      await new Promise((r) => setTimeout(r, 300));
      const s = document.createElement("span");
      s.textContent = "  ✓ " + summary;
      t.appendChild(s);
    }
    const bot = add("msg bot");
    for (const ch of rec.answer.match(/[\s\S]{1,6}/g)) {
      bot.textContent += ch;
      log.scrollTop = log.scrollHeight;
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  const LABELS = {
    list_projects: () => "list_projects()",
    get_project: (i) => `get_project("${i && i.id}")`,
    get_experience: () => "get_experience()",
    get_skills: () => "get_skills()",
  };

  function add(cls, text) {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = text || "";
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function trace(name, input) {
    const el = document.createElement("div");
    el.className = "trace";
    const fn = document.createElement("span");
    fn.className = "fn";
    fn.textContent = "→ " + (LABELS[name] ? LABELS[name](input) : name + "()");
    el.appendChild(fn);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  fetch(window.AGENT_API + "/health")
    .then((r) => r.json())
    .then((h) => {
      dot.className = "dot " + (h.mock ? "mock" : "live");
      statusText.textContent = h.mock ? "mock mode" : "live";
    })
    .catch(() => {
      dot.className = "dot";
      statusText.textContent = "recorded mode";
    });

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    send.disabled = true;
    root.querySelector(".suggest")?.remove();
    add("msg user", question);
    history.push({ role: "user", content: question });

    let bot = null;
    let answer = "";
    let current = null;
    let thinking = document.createElement("div");
    thinking.className = "thinking";
    thinking.innerHTML = "<i></i><i></i><i></i>";
    log.appendChild(thinking);
    log.scrollTop = log.scrollHeight;
    const unthink = () => { thinking?.remove(); thinking = null; };
    try {
      const res = await fetch(window.AGENT_API + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "The demo is unavailable right now.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data: /, "");
          buf = buf.slice(i + 2);
          if (!line) continue;
          const e = JSON.parse(line);
          if (e.type !== "done") unthink();
          if (e.type === "tool") { current = trace(e.name, e.input); bot = null; }
          else if (e.type === "tool_result" && current) {
            const s = document.createElement("span");
            s.textContent = "  ✓ " + e.summary;
            current.appendChild(s);
          }
          else if (e.type === "text") {
            if (!bot) bot = add("msg bot");
            answer += e.delta;
            bot.textContent += e.delta;
            log.scrollTop = log.scrollHeight;
          }
          else if (e.type === "error") add("msg bot err", e.message);
          else if (e.type === "unavailable") { history.pop(); await replay(question); return; }
        }
      }
      if (answer) history.push({ role: "assistant", content: answer.slice(0, 2000) });
      else history.pop();
    } catch (err) {
      history.pop();
      unthink();
      if (err.message === "Failed to fetch") await replay(question);
      else add("msg bot err", err.message);
    } finally {
      unthink();
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = "";
    ask(q);
  });
  root.querySelectorAll(".suggest button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
})();

// Live usage stats next to the agent: real-visitor counts from the worker, and
// the latest eval score from evals/results.json.
(function () {
  const els = document.querySelectorAll("[data-stat]");
  if (!els.length) return;
  const set = (key, value) => document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
    if (typeof value === "number") {
      el.textContent = "0";
      el.dataset.count = String(value);
      countUp(el, value);
    } else el.textContent = value;
  });
  function countUp(el, end) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = end.toLocaleString("en-US"); return; }
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / 1200);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 }).observe(el);
  }
  fetch(window.AGENT_API + "/stats")
    .then((r) => r.json())
    .then((s) => {
      set("questions", s.questions);
      set("tool_calls", s.tool_calls);
      set("since", new Date(s.since + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    })
    .catch(() => {});
  fetch(new URL("evals/results.json", document.baseURI))
    .then((r) => r.json())
    .then(({ summary }) => set("evals", `${summary.passed}/${summary.total}`))
    .catch(() => {});
})();
