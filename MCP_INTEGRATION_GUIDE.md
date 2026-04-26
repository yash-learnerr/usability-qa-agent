# QA Agent MCP Integration Guide

## Expected Runtime

The QA agent is driven by markdown instructions and executed by the host AI IDE or CLI agent.

Startup contract:

1. User types `start-qa-agent`.
2. Host agent reads `AGENT.md`.
3. Host agent reads `prompts/qa-agent.md`.
4. Host agent loads `config/qa-config.json`.
5. Host agent opens the configured site through MCP browser tools.

There is no required repo-local launcher for the QA run.

## Required MCP Capabilities

The runtime must support:

- browser navigation
- viewport resizing
- screenshots
- DOM evaluation
- click and type actions
- waiting for page state

## Required Outputs

During the run, the host agent should write:

- `runtime/run-context.json`
- `runtime/crawl-plan.json`
- `reports/qa-report.json`
- `reports/qa-report-<token>.json`

## Failure Rule

If the MCP browser session cannot be opened, the run must stop with `blocked_mcp_browser`.
