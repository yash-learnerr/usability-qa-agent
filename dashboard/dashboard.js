const API = "/api";
const PAGE_SIZE = 10;

let allReports = [];
let currentPage = 1;
let reportData = null;
let currentBrowsePath = "";

function fmt(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString();
}

function fmtDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
}

function statusBadge(status) {
  const map = {
    tested: "badge-green",
    failed: "badge-red",
    skipped: "badge-gray",
    passed: "badge-green",
  };
  const label = String(status || "unknown").toUpperCase();
  return `<span class="badge ${map[status] || "badge-gray"}">${label}</span>`;
}

function severityBadge(severity) {
  const map = {
    High: "badge-red",
    Medium: "badge-yellow",
    Low: "badge-blue",
  };
  return `<span class="badge ${map[severity] || "badge-gray"}">${severity || "Unknown"}</span>`;
}

function typeBadge(type) {
  const map = {
    UI: "badge-blue",
    UX: "badge-yellow",
    Accessibility: "badge-red",
    Bug: "badge-red",
  };
  return `<span class="badge ${map[type] || "badge-gray"}">${type || "Issue"}</span>`;
}

async function apiFetch(path, options) {
  try {
    const response = await fetch(API + path, options);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  } catch (error) {
    console.error("API error", path, error);
    return null;
  }
}

async function initOverview() {
  const data = await apiFetch("/overview");
  if (!data) return;

  const totalRuns = document.getElementById("total-runs");
  const totalIssues = document.getElementById("total-issues");
  const totalFixed = document.getElementById("total-fixed");
  const lastRun = document.getElementById("last-run");
  const recentReports = document.getElementById("recent-reports");

  if (totalRuns) totalRuns.textContent = data.total_runs ?? "-";
  if (totalIssues) totalIssues.textContent = data.total_issues ?? "-";
  if (totalFixed) totalFixed.textContent = data.total_fixed ?? "-";
  if (lastRun) lastRun.textContent = data.last_run ? fmtDate(data.last_run) : "-";

  if (!recentReports) return;
  if (!data.recent_reports || !data.recent_reports.length) {
    recentReports.innerHTML =
      '<div class="empty">No reports yet. Run the QA agent to generate reports.</div>';
    return;
  }

  recentReports.innerHTML = data.recent_reports
    .map(
      (report) => `
      <a href="report-view.html?id=${encodeURIComponent(report.id)}" class="report-item">
        <div>
          <div class="report-item-url">${report.seed_url || report.id}</div>
          <div class="report-item-date">${fmt(report.generated_at)}</div>
        </div>
        <div class="report-item-stats">
          <span>${report.pages_tested || 0} pages</span>
          <span>${report.issues_found || 0} issues</span>
          <span>${report.issues_fixed || 0} fixed</span>
        </div>
        ${statusBadge((report.issues_found || 0) === 0 ? "passed" : "failed")}
      </a>`,
    )
    .join("");
}

async function initReports() {
  const data = await apiFetch("/reports");
  allReports = data || [];
  renderReports();
}

function filterReports() {
  currentPage = 1;
  renderReports();
}

function renderReports() {
  const urlFilter = document.getElementById("filter-url")?.value?.toLowerCase() || "";
  const statusFilter = document.getElementById("filter-status")?.value || "";
  const dateFilter = document.getElementById("filter-date")?.value || "";

  const filtered = allReports.filter((report) => {
    const url = String(report.seed_url || report.id || "").toLowerCase();
    const found = report.issues_found ?? 0;
    const fixed = report.issues_fixed ?? 0;
    const health =
      found === 0 ? "clean" : fixed >= found ? "fixed" : fixed > 0 ? "partial" : "issues";
    const runDate = report.generated_at ? String(report.generated_at).slice(0, 10) : "";

    return (
      (!urlFilter || url.includes(urlFilter)) &&
      (!statusFilter || health === statusFilter) &&
      (!dateFilter || runDate === dateFilter)
    );
  });

  const tbody = document.getElementById("reports-tbody");
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageReports = filtered.slice(start, start + PAGE_SIZE);

  if (!pageReports.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No reports found.</td></tr>';
  } else {
    tbody.innerHTML = pageReports
      .map((report) => {
        const found = report.issues_found ?? 0;
        const fixed = report.issues_fixed ?? 0;
        const healthBadge =
          found === 0
            ? '<span class="badge badge-green">Clean</span>'
            : fixed >= found
              ? '<span class="badge badge-teal">All Fixed</span>'
              : fixed > 0
                ? '<span class="badge badge-yellow">Partial</span>'
                : '<span class="badge badge-red">Issues</span>';

        return `
          <tr>
            <td>${fmtDate(report.generated_at)}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${report.seed_url || ""}">
              ${report.seed_url || report.id}
            </td>
            <td>${report.pages_tested ?? "-"}</td>
            <td>${found}</td>
            <td>${fixed}</td>
            <td>${healthBadge}</td>
            <td><a href="report-view.html?id=${encodeURIComponent(report.id)}" class="btn" style="padding:5px 14px;font-size:12px">View</a></td>
          </tr>`;
      })
      .join("");
  }

  const pagination = document.getElementById("pagination");
  if (!pagination) return;
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  pagination.innerHTML = Array.from({ length: pages }, (_, index) => {
    const pageNumber = index + 1;
    return `<button class="page-btn ${pageNumber === currentPage ? "active" : ""}" onclick="goPage(${pageNumber})">${pageNumber}</button>`;
  }).join("");
}

function goPage(pageNumber) {
  currentPage = pageNumber;
  renderReports();
}

async function initReportView() {
  const reportId = new URLSearchParams(location.search).get("id");
  if (!reportId) return;

  reportData = await apiFetch("/report/" + encodeURIComponent(reportId));
  if (!reportData) return;

  const title = document.getElementById("report-title");
  const meta = document.getElementById("report-meta");
  const kpis = document.getElementById("report-kpis");

  if (title) title.textContent = reportData.meta?.seed_url || reportId;
  if (meta) meta.innerHTML = `<span style="color:var(--text-muted);font-size:13px">Generated: ${fmt(reportData.meta?.generated_at)}</span>`;

  const summary = reportData.summary || {};
  if (kpis) {
    const cards = [
      ["Pages Tested", summary.total_pages_tested ?? "-"],
      ["Issues Found", summary.total_issues_found ?? "-"],
      ["Issues Fixed", summary.total_issues_fixed ?? "-"],
      ["Remaining", summary.remaining_issues ?? "-"],
    ];
    kpis.innerHTML = cards
      .map(
        ([label, value]) => `
        <div class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-label">${label}</div>
            <div class="kpi-value">${value}</div>
          </div>
        </div>`,
      )
      .join("");
  }

  populateIssuePageFilter();
  renderIssues();
  renderFixes();
}

function populateIssuePageFilter() {
  const select = document.getElementById("issue-page-filter");
  if (!select || !reportData) return;
  const issues = reportData.issues || reportData.remaining_issues || [];
  const urls = [...new Set(issues.map((issue) => issue.page_url).filter(Boolean))];
  select.innerHTML = '<option value="">All Pages</option>';
  urls.forEach((url) => {
    const option = document.createElement("option");
    option.value = url;
    try {
      option.textContent = new URL(url).pathname || url;
    } catch {
      option.textContent = url;
    }
    select.appendChild(option);
  });
}

function filteredIssues() {
  if (!reportData) return [];
  const issues = reportData.issues || reportData.remaining_issues || [];
  const pageFilter = document.getElementById("issue-page-filter")?.value || "";
  const typeFilter = document.getElementById("issue-type-filter")?.value || "";
  const severityFilter = document.getElementById("issue-severity-filter")?.value || "";

  return issues.filter((issue) => {
    return (
      (!pageFilter || issue.page_url === pageFilter) &&
      (!typeFilter || issue.type === typeFilter) &&
      (!severityFilter || issue.severity === severityFilter)
    );
  });
}

function filterIssues() {
  renderIssues();
}

function renderIssues() {
  const container = document.getElementById("issues-list");
  if (!container || !reportData) return;

  const issues = filteredIssues();
  const pages = reportData.pages || [];

  if (!issues.length) {
    container.innerHTML = '<div class="empty">No issues recorded.</div>';
    return;
  }

  const grouped = new Map();
  issues.forEach((issue) => {
    const key = issue.page_url || "__unknown__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(issue);
  });

  const orderedUrls = [
    ...pages.map((page) => page.url).filter((url) => grouped.has(url)),
    ...[...grouped.keys()].filter((url) => !pages.some((page) => page.url === url)),
  ];

  container.innerHTML = orderedUrls
    .map((url) => {
      const groupIssues = grouped.get(url) || [];
      const page = pages.find((entry) => entry.url === url);
      const pageLabel = page?.index ? `#${page.index}` : "#?";
      const pageStatus = page?.status || "tested";

      return `
        <div class="page-group">
          <div class="page-group-header" onclick="togglePageGroup(this)">
            <span class="page-group-index">${pageLabel}</span>
            <a href="${url}" target="_blank" class="page-group-url" onclick="event.stopPropagation()">${url}</a>
            <div class="page-group-meta">
              ${statusBadge(pageStatus)}
              <span class="page-group-count">${groupIssues.length} issue${groupIssues.length === 1 ? "" : "s"}</span>
              <span class="page-group-chevron">▼</span>
            </div>
          </div>
          <div class="page-group-issues">
            ${groupIssues.map(issueCardHTML).join("")}
          </div>
        </div>`;
    })
    .join("");
}

function togglePageGroup(header) {
  header.classList.toggle("collapsed");
}

function issueCardHTML(issue) {
  const shot = issue.screenshots?.issue || issue.screenshots?.full_page || "";
  const meta = [
    issue.device ? `<span>${issue.device}</span>` : "",
    issue.page_url ? `<span><a href="${issue.page_url}" target="_blank" style="color:var(--teal)">${issue.page_url}</a></span>` : "",
    issue.fix_file ? `<span>${issue.fix_file}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="issue-card issue-card--with-shot">
      <div class="issue-card-main">
        <div class="issue-card-header">
          ${typeBadge(issue.type)}
          ${severityBadge(issue.severity)}
          <span class="issue-card-title">${issue.title || "Issue"}</span>
        </div>
        <div class="issue-card-body">${issue.description || ""}</div>
        <div class="issue-card-meta">${meta}</div>
      </div>
      ${
        shot
          ? `<div class="issue-screenshots-panel">
              <div class="issue-screenshot">
                <img src="../${shot}" alt="issue screenshot" onerror="this.parentElement.style.display='none'">
                <span class="issue-screenshot-label">Issue</span>
              </div>
            </div>`
          : ""
      }
    </div>`;
}

function renderFixes() {
  const container = document.getElementById("fixes-list");
  if (!container || !reportData) return;

  const fixes = reportData.fixes_applied || [];
  if (!fixes.length) {
    container.innerHTML = '<div class="empty">No fixes recorded.</div>';
    return;
  }

  container.innerHTML = fixes
    .map(
      (fix) => `
      <div class="fix-card">
        <div class="fix-card-file">${fix.file || fix.fix_file || "Updated file"}</div>
        <div class="fix-card-change">${fix.change || fix.description || fix.issue || ""}</div>
        <div class="fix-card-status">${fix.status || ""}</div>
      </div>`,
    )
    .join("");
}

function showTab(name, button) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((tabButton) => tabButton.classList.remove("active"));
  document.getElementById("tab-" + name)?.classList.add("active");
  button?.classList.add("active");
}

async function initConfig() {
  const config = await apiFetch("/config");
  if (!config) return;

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  };

  setValue("website_url", config.website_url || "");
  setValue("repository_path", config.repository_path || "");
  setValue("single_page", config.single_page || "");

  const isProject = document.getElementById("is_project");
  if (isProject) {
    isProject.checked = !!(config.is_project || config.repository_path);
    toggleProjectMode();
  }

  const authRequired = document.getElementById("auth_required");
  if (authRequired) {
    authRequired.checked = !!config.auth_required;
    toggleAuthMode();
  }

  const checks = config.checks || {};
  const checkMap = {
    check_overflow: "overflow",
    check_clipping: "clipping",
    check_touch_targets: "touch_targets",
    check_alt_text: "alt_text",
    check_focus_styles: "focus_styles",
    check_color_contrast: "color_contrast",
    check_typography: "typography",
    check_tab_overflow: "tab_overflow",
    check_responsive_grids: "responsive_grids",
    check_text_overflow: "text_overflow",
    check_overlap: "overlap",
    check_responsive_media: "responsive_media",
    check_responsive_tables: "responsive_tables",
    check_fixed_ui_obstruction: "fixed_ui_obstruction",
    check_url_response: "url_response",
    check_cta_redirects: "cta_redirects",
    check_issue_screenshots: "issue_screenshots",
  };

  Object.entries(checkMap).forEach(([inputName, key]) => {
    const input = document.querySelector(`[name="${inputName}"]`);
    if (input) input.checked = checks[key] !== false;
  });

  const viewports = config.viewports || {};
  ["mobile", "tablet", "desktop"].forEach((device) => {
    setValue(`${device}_width`, viewports[device]?.width || "");
    setValue(`${device}_height`, viewports[device]?.height || "");
  });

  loadUrlHistory(config.url_history || []);
}

function toggleProjectMode() {
  const isProject = document.getElementById("is_project")?.checked;
  const repoGroup = document.getElementById("repo-path-group");
  const card = document.getElementById("project-toggle-card");
  const desc = document.getElementById("project-mode-desc");
  const repoInput = document.getElementById("repository_path");

  if (repoGroup) repoGroup.style.display = isProject ? "block" : "none";
  if (card) card.classList.toggle("active", !!isProject);

  if (desc) {
    desc.innerHTML = isProject
      ? '<span class="mode-badge mode-badge-project">Project Mode</span><br>Repository path required. The QA agent can apply code fixes in this repo.'
      : '<span class="mode-badge mode-badge-report">Report Only</span><br>The QA agent will inspect and report issues without changing code.';
  }

  if (!isProject && repoInput) {
    repoInput.value = "";
    closeBrowser();
  }
}

function toggleAuthMode() {
  const group = document.getElementById("auth-mode-group");
  const checked = document.getElementById("auth_required")?.checked;
  if (group) group.style.display = checked ? "block" : "none";
}

function loadUrlHistory(urls) {
  const container = document.getElementById("url-history");
  if (!container) return;

  if (!urls.length) {
    container.innerHTML = '<div class="empty">No URL history yet.</div>';
    return;
  }

  container.innerHTML = [...new Set(urls)]
    .map(
      (url) => `
      <div class="url-history-item">
        <span class="url-text">${url}</span>
        <div class="url-actions">
          <button class="url-btn" onclick="useUrl('${url}')">Use</button>
        </div>
      </div>`,
    )
    .join("");
}

function useUrl(url) {
  const input = document.getElementById("website_url");
  if (input) {
    input.value = url;
    input.focus();
  }
}

async function openBrowser() {
  const panel = document.getElementById("dir-browser");
  if (!panel) return;
  panel.style.display = "block";
  await browseTo(document.getElementById("repository_path")?.value?.trim() || "");
}

function closeBrowser() {
  const panel = document.getElementById("dir-browser");
  if (panel) panel.style.display = "none";
}

async function browseTo(path) {
  const list = document.getElementById("dir-list");
  const current = document.getElementById("dir-current-path");
  const selected = document.getElementById("dir-selected-label");
  if (!list) return;

  list.innerHTML = '<div class="loading">Loading...</div>';
  const data = await apiFetch("/browse" + (path ? `?path=${encodeURIComponent(path)}` : ""));
  if (!data) {
    list.innerHTML = '<div class="empty">Could not load directory.</div>';
    return;
  }

  currentBrowsePath = data.current || "";
  if (current) current.textContent = currentBrowsePath;
  if (selected) selected.textContent = currentBrowsePath || "No folder selected";

  const folders = (data.entries || []).filter((entry) => entry.is_dir);
  if (!folders.length) {
    list.innerHTML = '<div class="empty">No subdirectories.</div>';
    return;
  }

  list.innerHTML = folders
    .map(
      (entry) => `
      <div class="dir-item" onclick="browseTo('${entry.path.replace(/'/g, "\\'")}')">
        <span class="dir-item-icon">DIR</span>
        <span class="dir-item-name">${entry.name}</span>
        <span class="dir-item-enter">Open</span>
      </div>`,
    )
    .join("");
}

async function browseUp() {
  if (!currentBrowsePath) return;
  const data = await apiFetch(`/browse?path=${encodeURIComponent(currentBrowsePath)}`);
  if (data?.parent) {
    await browseTo(data.parent);
  }
}

function selectCurrentDir() {
  const input = document.getElementById("repository_path");
  if (input && currentBrowsePath) {
    input.value = currentBrowsePath;
  }
  closeBrowser();
}

async function saveConfig(event) {
  if (event?.preventDefault) event.preventDefault();

  const isProject = document.getElementById("is_project")?.checked || false;
  const repositoryPath = document.getElementById("repository_path")?.value?.trim() || "";
  const status = document.getElementById("save-status");

  if (isProject && !repositoryPath) {
    if (status) {
      status.textContent = "Repository path is required in Project mode.";
      status.className = "save-status error";
    }
    document.getElementById("repository_path")?.focus();
    return false;
  }

  const checkMap = {
    overflow: "check_overflow",
    clipping: "check_clipping",
    touch_targets: "check_touch_targets",
    alt_text: "check_alt_text",
    focus_styles: "check_focus_styles",
    color_contrast: "check_color_contrast",
    typography: "check_typography",
    tab_overflow: "check_tab_overflow",
    responsive_grids: "check_responsive_grids",
    text_overflow: "check_text_overflow",
    overlap: "check_overlap",
    responsive_media: "check_responsive_media",
    responsive_tables: "check_responsive_tables",
    fixed_ui_obstruction: "check_fixed_ui_obstruction",
    url_response: "check_url_response",
    cta_redirects: "check_cta_redirects",
    issue_screenshots: "check_issue_screenshots",
  };

  const checks = {};
  Object.entries(checkMap).forEach(([key, inputName]) => {
    const input = document.querySelector(`[name="${inputName}"]`);
    checks[key] = input ? input.checked : true;
  });

  const payload = {
    website_url: document.getElementById("website_url")?.value || "",
    is_project: isProject,
    repository_path: isProject ? repositoryPath : "",
    auth_required: document.getElementById("auth_required")?.checked || false,
    auth_mode: "mcp",
    single_page: document.getElementById("single_page")?.value || "",
    checks,
    viewports: {
      mobile: {
        width: parseInt(document.getElementById("mobile_width")?.value || "375", 10),
        height: parseInt(document.getElementById("mobile_height")?.value || "812", 10),
      },
      tablet: {
        width: parseInt(document.getElementById("tablet_width")?.value || "768", 10),
        height: parseInt(document.getElementById("tablet_height")?.value || "1024", 10),
      },
      desktop: {
        width: parseInt(document.getElementById("desktop_width")?.value || "1440", 10),
        height: parseInt(document.getElementById("desktop_height")?.value || "900", 10),
      },
    },
  };

  const result = await apiFetch("/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!result) {
    if (status) {
      status.textContent = "Failed to save configuration.";
      status.className = "save-status error";
    }
    return false;
  }

  if (status) {
    status.textContent = "Configuration saved successfully.";
    status.className = "save-status success";
  }
  return true;
}

async function runQAFromConfig() {
  const ok = await saveConfig();
  if (!ok) return;

  const status = document.getElementById("save-status");
  if (status) {
    status.textContent =
      'Configuration saved. Next step: run "start-qa-agent" in your AI IDE or CLI agent.';
    status.className = "save-status success";
  }
}

async function resetConfig() {
  if (!confirm("Reset configuration to defaults?")) return;
  await apiFetch("/config/reset", { method: "POST" });
  location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop() || "index.html";

  if (page === "index.html" || page === "") initOverview();
  if (page === "reports.html") initReports();
  if (page === "report-view.html") initReportView();
  if (page === "config.html") initConfig();
});
