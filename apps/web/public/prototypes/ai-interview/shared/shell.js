// Injects the dashboard sidebar (mirrors blogbat's actual /(dashboard) nav) and the
// prototype banner. Opt in by setting <body data-shell="dashboard">, otherwise just
// data-shell="banner-only" (or no attribute) gets the banner only.

(function () {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  // Mirror of blogbat's actual dashboard nav (see apps/web/src/app/(dashboard))
  const SIDEBAR_HTML = `
    <aside class="shell-sidebar">
      <div class="sidebar-brand">
        <img src="/blogbat-header-logo.svg" alt="" style="height: 22px; vertical-align: middle;"
             onerror="this.style.display='none'" />
        <span style="margin-left: 6px;">blogbat</span>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Content</div>
        <a class="sidebar-link" href="#" title="/dashboard">📊 Dashboard</a>
        <a class="sidebar-link" href="#" title="/posts">📝 Posts</a>
        <a class="sidebar-link" href="#" title="/categories">📂 Categories</a>
        <a class="sidebar-link" href="#" title="/media">🖼️ Media</a>
        <a class="sidebar-link" href="#" title="/search">🔎 Search</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Generate</div>
        <a class="sidebar-link" href="#" title="/generate/keyword">🔑 By keyword</a>
        <a class="sidebar-link" href="#" title="/generate/bulk">📥 Bulk</a>
        <a class="sidebar-link" href="#" title="/generate/content-plan">🗺️ Content plan</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Interviews <span style="background: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); padding: 1px 6px; border-radius: 4px; font-size: 9px; margin-left: 4px;">NEW</span></div>
        <a class="sidebar-link active" href="../admin/links-list.html" title="/interview/links">🔗 Share links</a>
        <a class="sidebar-link" href="../admin/session-detail.html" title="/interview/sessions">🎙️ Sessions</a>
        <a class="sidebar-link" href="../author/dashboard-cta.html" title="/interview/new">＋ Start interview</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Writing</div>
        <a class="sidebar-link" href="#" title="/writing/skills">✍️ Writing skills</a>
        <a class="sidebar-link" href="#" title="/writing/context-tags">🏷️ Context tags</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">SEO</div>
        <a class="sidebar-link" href="#" title="/seo/analytics">📈 Analytics</a>
        <a class="sidebar-link" href="#" title="/seo/internal-links">🔗 Internal links</a>
        <a class="sidebar-link" href="#" title="/seo/sitemaps">🗺️ Sitemaps</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Settings</div>
        <a class="sidebar-link" href="../settings/interview-defaults.html" title="/settings/interview-defaults">⚙️ Interview defaults</a>
        <a class="sidebar-link" href="#" title="/settings">⚙️ Site settings</a>
      </div>
    </aside>
  `;

  function bannerHtml(wired) {
    const wiredRow = wired
      ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid hsl(var(--border)); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10.5px; color: hsl(var(--muted-foreground)); line-height: 1.5;">${wired}</div>`
      : "";
    return `
      <div class="proto-banner" style="max-width: 360px;">
        <div>
          <strong>AI Interview prototype</strong>
          &nbsp;·&nbsp;
          <a href="../index.html">All states</a>
          &nbsp;·&nbsp;
          <a href="/docs/plans/2026-05-19-ai-interview-mode-design.md" target="_blank" rel="noopener">design</a>
        </div>
        ${wiredRow}
      </div>
    `;
  }

  function init() {
    const mode = document.body.dataset.shell || "banner-only";
    const wired = document.body.dataset.wired || "";
    if (mode === "dashboard") {
      const existing = Array.from(document.body.childNodes);
      const shell = el(`<div class="shell"></div>`);
      const main = el(`<main class="shell-main"></main>`);
      existing.forEach((c) => main.appendChild(c));
      shell.appendChild(el(SIDEBAR_HTML));
      shell.appendChild(main);
      document.body.appendChild(shell);
    }
    document.body.appendChild(el(bannerHtml(wired)));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
