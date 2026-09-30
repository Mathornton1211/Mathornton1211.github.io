// Renders the resume from data/profile.json. Used by resume.html (the standard
// version) and tailor.html (with a tailoring result applied on top).
window.renderResume = function (el, profile, t) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const projects = t
    ? t.project_order.map((id) => profile.projects.find((p) => p.id === id)).filter(Boolean)
    : profile.projects;
  const bulletsFor = (job) => (t && (t.experience.find((e) => e.id === job.id) || {}).bullets) || job.bullets;
  const skills = t
    ? `<p>${t.skills_focus.map(esc).join(" · ")}</p>`
    : Object.entries(profile.skills).map(([k, v]) => `<p><b>${esc(k)}:</b> ${v.map(esc).join(", ")}</p>`).join("");

  el.innerHTML = `
    <header class="r-head">
      <h1>${esc(profile.name)}</h1>
      <div class="r-headline">${esc(t ? t.headline : profile.headline)}</div>
      <div class="r-contact">${esc(profile.location)} · <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a> · <a href="${esc(profile.github)}">github.com/Mathornton1211</a> · <a href="https://www.linkedin.com/in/mathew-thornton">linkedin.com/in/mathew-thornton</a> · <a href="https://mathornton1211.github.io">mathornton1211.github.io</a></div>
    </header>
    <p class="r-summary">${esc(t ? t.summary : profile.summary)}</p>
    <h2>Experience</h2>
    ${profile.experience.map((j) => `
      <div class="r-job">
        <div class="r-row"><div><b>${esc(j.title)}</b>, ${esc(j.org)}</div><span class="r-d">${esc(j.dates)}</span></div>
        <ul>${bulletsFor(j).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>`).join("")}
    <h2>Selected projects</h2>
    ${projects.map((p) => `
      <div class="r-job">
        <div class="r-row"><div><b>${esc(p.name)}</b>, ${esc(p.kind)}</div><span class="r-d">${p.url ? `<a href="${esc(p.url)}">source</a>` : ""}</span></div>
        <ul><li>${esc(p.one_liner)} ${esc(p.details[0])}</li><li class="r-stack">${p.stack.map(esc).join(" · ")}</li></ul>
      </div>`).join("")}
    <h2>Skills</h2>
    ${skills}`;
};
