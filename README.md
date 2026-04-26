# QA Agent

Markdown-first QA automation for MCP-enabled AI IDE and CLI agents.

`start-qa-agent` is a trigger phrase, not a Python entrypoint. The agent should read `AGENT.md`, load `config/qa-config.json`, open the site with MCP browser tools, review responsive and UX issues, optionally fix the repo, and write reports.

## Quick Start

1. Optional: run the dashboard UI to edit config and view reports.

```bash
python dashboard.py
```

2. In your AI IDE or CLI agent, type:

```text
start-qa-agent
```

No repo-local launcher is required for the QA run itself.

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

## Runtime Contract

On `start-qa-agent`, the host agent should:

1. Read `config/qa-config.json`.
2. Read `prompts/qa-agent.md`.
3. Build `runtime/run-context.json` and `runtime/crawl-plan.json`.
4. Open the configured URL in a real MCP browser session.
5. Test responsive design, accessibility, and primary CTAs.
6. Apply fixes only when `is_project` is enabled and `repository_path` is set.
7. Write `reports/qa-report.json` and `reports/qa-report-<token>.json`.

## Configuration

`config/qa-config.json` is the single source of truth for a run.

Key fields:

- `website_url`
- `is_project`
- `repository_path`
- `auth_required`
- `single_page`
- `checks`
- `viewports`

If `single_page` is empty, the agent should crawl the site from `website_url`.

## Dashboard

The dashboard is optional and exists only for user-facing configuration and report viewing.

Run:

```bash
python dashboard/server.py
```

Then open `http://localhost:9090`.

## Notes

- Credentials are never stored.
- Authentication is handled manually in the MCP browser window.
- The QA run must not depend on local Python or JavaScript startup logic.
