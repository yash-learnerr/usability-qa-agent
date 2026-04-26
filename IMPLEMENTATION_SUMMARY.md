# QA Agent Implementation Summary

## Current Shape

The repository is now organized around an MD-first runtime:

- `AGENT.md` starts the agent behavior
- `prompts/qa-agent.md` defines the detailed QA workflow
- `config/qa-config.json` stores saved user settings
- `dashboard/` remains optional UI code for config and report viewing

## Important Change

`start-qa-agent` is no longer a local launcher requirement. It is a trigger phrase that the host AI IDE or CLI agent should interpret by following the markdown files in this repo.

## Output Flow

On each run the host agent should create:

- `runtime/run-context.json`
- `runtime/crawl-plan.json`
- `reports/qa-report.json`
- `reports/qa-report-<token>.json`

## Dashboard Scope

Python and JavaScript are retained only for the optional dashboard experience. They are not part of the QA agent startup path.
