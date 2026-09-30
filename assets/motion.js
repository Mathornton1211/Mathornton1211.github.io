// Site-wide motion. Everything here is progressive: with JS off or
// prefers-reduced-motion on, the page is complete and static.
(function () {
  const doc = document.documentElement;
  doc.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;

  // Nav: condense into a floating pill once the page scrolls.
  const nav = document.querySelector("nav.top");
  if (nav) {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;height:40px;width:1px;pointer-events:none";
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => nav.classList.toggle("scrolled", !e.isIntersecting)).observe(sentinel);
  }

  // Theme toggle: light by default, dark on request, remembered per visitor.
  if (nav) {
    const btn = document.createElement("button");
    btn.className = "theme";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle dark mode");
    btn.innerHTML =
      '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    btn.addEventListener("click", () => {
      const dark = doc.dataset.theme !== "dark";
      if (dark) doc.dataset.theme = "dark";
      else delete doc.dataset.theme;
      try { localStorage.theme = dark ? "dark" : "light"; } catch {}
    });
    const ul = nav.querySelector("ul");
    const right = document.createElement("div");
    right.className = "right";
    ul.replaceWith(right);
    right.append(ul, btn);
  }

  // Case study pages: reveal their blocks without per-page markup.
  document.querySelectorAll("main.case > *:not(.eyebrow):not(h1):not(.lede)").forEach((el) => el.classList.add("rv"));

  // Reveal on scroll, with a stagger for siblings marked data-stagger.
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    [...group.children].forEach((c, i) => { c.classList.add("rv"); c.style.setProperty("--i", i); });
  });
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  document.querySelectorAll(".rv, .timeline").forEach((el) => io.observe(el));

  // Count-up numbers: <b data-count="1144">0</b>
  const fmt = new Intl.NumberFormat("en-US");
  const counter = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      counter.unobserve(e.target);
      const el = e.target;
      const end = Number(el.dataset.count);
      if (reduced) { el.firstChild.textContent = fmt.format(end); continue; }
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 4);
        el.firstChild.textContent = fmt.format(Math.round(end * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => {
    if (!el.firstChild || el.firstChild.nodeType !== 3) el.prepend(document.createTextNode("0"));
    counter.observe(el);
  });

  // Magnetic buttons: a small pull toward the cursor. Transform-only, rAF-batched.
  if (finePointer && !reduced) {
    document.querySelectorAll(".magnetic").forEach((btn) => {
      let raf = 0;
      btn.addEventListener("pointermove", (ev) => {
        const r = btn.getBoundingClientRect();
        const x = (ev.clientX - (r.left + r.width / 2)) * 0.22;
        const y = (ev.clientY - (r.top + r.height / 2)) * 0.32;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { btn.style.setProperty("--mx", x + "px"); btn.style.setProperty("--my", y + "px"); });
      });
      btn.addEventListener("pointerleave", () => { btn.style.setProperty("--mx", "0px"); btn.style.setProperty("--my", "0px"); });
    });
  }

  // Console spotlight follows the cursor.
  document.querySelectorAll(".agent").forEach((el) => {
    el.addEventListener("pointermove", (ev) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", ev.clientX - r.left + "px");
      el.style.setProperty("--sy", ev.clientY - r.top + "px");
    });
  });

  // Hero schematic: hovering a node highlights the wires that touch it.
  const sc = document.querySelector(".schematic svg");
  if (sc) {
    sc.querySelectorAll(".sc-node").forEach((node) => {
      const id = node.dataset.node;
      const wires = sc.querySelectorAll(`.sc-wire[data-ends~="${id}"]`);
      node.addEventListener("pointerenter", () => wires.forEach((w) => w.classList.add("hl")));
      node.addEventListener("pointerleave", () => wires.forEach((w) => w.classList.remove("hl")));
    });
    if (reduced) sc.pauseAnimations?.();
  }

  // Job-fit preview: step through requirements like the model reading them.
  const mini = document.querySelector(".mini");
  if (mini && !reduced) {
    const reqs = [...mini.querySelectorAll(".req")];
    let i = 0;
    let timer = 0;
    const step = () => {
      reqs.forEach((r) => r.classList.remove("on"));
      if (i < reqs.length) {
        reqs[i].classList.add("on", "done");
        i++;
        timer = setTimeout(step, 900);
      } else {
        timer = setTimeout(() => { reqs.forEach((r) => r.classList.remove("done")); i = 0; step(); }, 2600);
      }
    };
    new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) step();
    }, { threshold: 0.4 }).observe(mini);
  } else if (mini) {
    mini.querySelectorAll(".req").forEach((r) => r.classList.add("done"));
  }

  // Copy email with confirmation.
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.classList.add("done");
        setTimeout(() => btn.classList.remove("done"), 2200);
      } catch {
        location.href = "mailto:" + btn.dataset.copy;
      }
    });
  });

  // Footer clock: local time in San Diego, a small sign someone is home.
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const f = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    const set = () => (clock.textContent = f.format(new Date()) + " in San Diego");
    set();
    setInterval(set, 30000);
  }
})();
