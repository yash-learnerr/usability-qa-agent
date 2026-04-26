# QA Agent

## Trigger

Treat each of these user messages as an immediate instruction to run the QA agent:

- `start-qa-agent`
- `start qa agent`
- `qa agent`

The trigger phrase is the startup mechanism. Do not look for or run a repo-local Python or shell launcher to activate the agent.

---

## Runtime Model

This repository is markdown-driven.

- `AGENT.md` is the entry contract the host agent should follow first.
- `prompts/qa-agent.md` is the detailed QA execution playbook.
- `config/qa-config.json` is the saved user configuration.
- Python and JavaScript in this repo are optional dashboard utilities only.

When the user triggers the agent, the host AI IDE or CLI agent must do the work directly through MCP browser tools.

---

## What To Do On `start-qa-agent`

1. Read `config/qa-config.json`.
2. Read `prompts/qa-agent.md`.
3. Resolve the run scope:
   - If `single_page` is set, test only that page.
   - Otherwise use `website_url` as the seed URL and build the crawl plan yourself.
4. Resolve the execution mode:
   - If `is_project` is `true` and `repository_path` is set, the run is `fix mode`.
   - Otherwise the run is `report-only mode`.
5. Write run artifacts directly:
   - `runtime/run-context.json`
   - `runtime/crawl-plan.json`
   - `reports/qa-report.json`
   - `reports/qa-report-<token>.json`
6. Open the site with MCP browser tools and run the responsive, accessibility, and UX review.
7. If fix mode is enabled, apply code fixes in the configured repository and re-test.

If `website_url` is empty, stop and ask the user for a URL instead of guessing.

---

## Required Behavior

- Use MCP browser tools for navigation, resizing, screenshots, clicks, typing, and DOM inspection.
- Open a real browser session. A run is invalid if no MCP browser window is opened.
- Review both hard UI breakage and softer mobile/tablet usability problems.
- Preserve manual login sessions when authentication is required.
- Never ask for or store credentials.
- Capture screenshot evidence for each recorded issue whenever possible.
- Fix root causes when code changes are allowed.
- Do not depend on repo-local Python startup files to prepare runtime state.

---

## Folder Structure

```text
qa-agent/
├── AGENT.md
├── README.md
├── config/
│   └── qa-config.json
├── prompts/
│   └── qa-agent.md
├── runtime/
│   └── README.md
├── reports/
├── screenshots/
├── dashboard/
│   ├── server.py
│   ├── index.html
│   ├── reports.html
│   ├── report-view.html
│   ├── config.html
│   ├── dashboard.js
│   └── styles.css
└── dashboard.py
```

Rules:

- `config/` stores user-controlled settings.
- `prompts/` stores markdown instructions for the runtime agent.
- `runtime/` stores agent-written run state only.
- `dashboard/` is optional UI code for configuration and report viewing.
- The QA run itself must work from markdown instructions plus MCP tools.

---

## Outputs

Every run should produce:

- a crawl plan with per-page status
- full-page screenshots for each tested viewport
- focused issue screenshots when possible
- a consolidated JSON report
- code fixes only when project mode is enabled

---

## Completion Standard

The task is complete only when:

1. the site was opened through MCP browser tools
2. all targeted pages were tested or explicitly skipped
3. responsive, accessibility, CTA, and design-quality checks were performed
4. reports were written
5. fixes were applied and re-tested when fix mode was enabled
