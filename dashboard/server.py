#!/usr/bin/env python3
"""Optional dashboard server for QA config and report viewing."""

from __future__ import annotations

import argparse
import json
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


DASHBOARD_DIR = Path(__file__).resolve().parent
ROOT_DIR = DASHBOARD_DIR.parent
CONFIG_DIR = ROOT_DIR / "config"
REPORTS_DIR = ROOT_DIR / "reports"
SCREENSHOTS_DIR = ROOT_DIR / "screenshots"
CONFIG_FILE = CONFIG_DIR / "qa-config.json"

CONFIG_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


DEFAULT_CONFIG = {
    "website_url": "",
    "is_project": False,
    "repository_path": "",
    "auth_required": False,
    "auth_mode": "mcp",
    "single_page": "",
    "checks": {
        "overflow": True,
        "clipping": True,
        "touch_targets": True,
        "alt_text": True,
        "focus_styles": True,
        "color_contrast": True,
        "typography": True,
        "tab_overflow": True,
        "responsive_grids": True,
        "text_overflow": True,
        "overlap": True,
        "responsive_media": True,
        "responsive_tables": True,
        "fixed_ui_obstruction": True,
        "url_response": True,
        "cta_redirects": True,
        "issue_screenshots": True,
    },
    "viewports": {
        "mobile": {"width": 375, "height": 812},
        "tablet": {"width": 768, "height": 1024},
        "desktop": {"width": 1440, "height": 900},
    },
    "url_history": [],
}


def _json_bytes(data) -> bytes:
    return json.dumps(data, indent=2, default=str).encode("utf-8")


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, default=str) + "\n", encoding="utf-8")


def _load_config() -> dict:
    data = _load_json(CONFIG_FILE)
    if isinstance(data, dict):
        return data
    return json.loads(json.dumps(DEFAULT_CONFIG))


def _ensure_report_token(path: Path, data: dict) -> str:
    meta = data.setdefault("meta", {})
    token = str(meta.get("token") or "").strip()
    if token:
        return token
    token = secrets.token_urlsafe(12)
    meta["token"] = token
    _save_json(path, data)
    return token


def _report_row(path: Path, data: dict) -> dict:
    token = _ensure_report_token(path, data)
    summary = data.get("summary", {})
    meta = data.get("meta", {})
    return {
        "id": token,
        "filename": path.name,
        "generated_at": meta.get("generated_at"),
        "seed_url": meta.get("seed_url", ""),
        "repo_path": meta.get("repo_path", ""),
        "pages_tested": summary.get("total_pages_tested", 0),
        "issues_found": summary.get("total_issues_found", 0),
        "issues_fixed": summary.get("total_issues_fixed", 0),
        "remaining": summary.get("remaining_issues", 0),
    }


def _load_all_reports() -> list[dict]:
    rows_by_token: dict[str, dict] = {}

    for path in REPORTS_DIR.glob("*.json"):
        data = _load_json(path)
        if not isinstance(data, dict):
            continue
        row = _report_row(path, data)
        token = row["id"]
        existing = rows_by_token.get(token)

        if not existing:
            rows_by_token[token] = row
            continue

        # Prefer the explicit `qa-report.json` entry when multiple files
        # share the same token. If the current row is the special
        # `qa-report.json` file, prefer it over previously seen files.
        existing_is_latest = existing.get("filename") == "qa-report.json"
        current_is_latest = row.get("filename") == "qa-report.json"
        if current_is_latest and not existing_is_latest:
            rows_by_token[token] = row

    return sorted(
        rows_by_token.values(),
        key=lambda row: row.get("generated_at") or "",
        reverse=True,
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, data, code: int = 200) -> None:
        self._send(code, _json_bytes(data), "application/json")

    def _send_text(self, code: int, text: str) -> None:
        self._send(code, text.encode("utf-8"), "text/plain; charset=utf-8")

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/overview":
            return self._api_overview()
        if path == "/api/reports":
            return self._send_json(_load_all_reports())
        if path.startswith("/api/report/"):
            report_id = unquote(path[len("/api/report/"):])
            return self._api_report(report_id)
        if path == "/api/config":
            return self._send_json(_load_config())
        if path == "/api/browse":
            return self._api_browse(parsed)

        return self._serve_static(parsed.path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/config":
            return self._api_save_config()
        if path == "/api/config/reset":
            return self._api_reset_config()

        self._send_json({"error": "Not found"}, 404)

    def _serve_static(self, request_path: str) -> None:
        clean = request_path.lstrip("/") or "index.html"
        file_path = ROOT_DIR / clean if clean.startswith("screenshots/") else DASHBOARD_DIR / clean

        if not file_path.exists() or not file_path.is_file():
            return self._send_text(404, "Not found")

        mime = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
        }.get(file_path.suffix.lower(), "application/octet-stream")

        self._send(200, file_path.read_bytes(), mime)

    def _api_overview(self) -> None:
        reports = _load_all_reports()
        self._send_json(
            {
                "total_runs": len(reports),
                "total_issues": sum(row.get("issues_found", 0) for row in reports),
                "total_fixed": sum(row.get("issues_fixed", 0) for row in reports),
                "last_run": reports[0].get("generated_at") if reports else None,
                "recent_reports": reports[:5],
            }
        )

    def _api_report(self, report_id: str) -> None:
        for path in REPORTS_DIR.glob("*.json"):
            data = _load_json(path)
            if not isinstance(data, dict):
                continue
            token = data.get("meta", {}).get("token")
            if token == report_id:
                data["_id"] = token
                return self._send_json(data)

        for candidate in (REPORTS_DIR / f"{report_id}.json", REPORTS_DIR / report_id):
            if not candidate.exists():
                continue
            data = _load_json(candidate)
            if not isinstance(data, dict):
                continue
            token = _ensure_report_token(candidate, data)
            data["_id"] = token
            return self._send_json(data)

        self._send_json({"error": f"Report '{report_id}' not found"}, 404)

    def _api_browse(self, parsed) -> None:
        query = parse_qs(parsed.query)
        requested_path = query.get("path", [""])[0].strip() or str(Path.home())

        try:
            target = Path(requested_path).resolve()
        except Exception:
            target = Path.home()

        if not target.exists() or not target.is_dir():
            target = Path.home()

        entries = []
        try:
            for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                if item.name.startswith("."):
                    continue
                try:
                    is_dir = item.is_dir()
                except PermissionError:
                    continue
                entries.append({"name": item.name, "path": str(item), "is_dir": is_dir})
        except PermissionError:
            entries = []

        parent = str(target.parent) if target != target.parent else None
        self._send_json({"current": str(target), "parent": parent, "entries": entries})

    def _api_save_config(self) -> None:
        body = self._read_json_body()
        if not body:
            return self._send_json({"error": "Empty body"}, 400)

        existing = _load_config()
        url_history = list(existing.get("url_history", []))
        website_url = str(body.get("website_url", "")).strip()
        if website_url and website_url not in url_history:
            url_history.insert(0, website_url)

        body["url_history"] = url_history[:20]
        body["updated_at"] = datetime.now(timezone.utc).isoformat()
        body["created_at"] = existing.get("created_at") or body["updated_at"]
        _save_json(CONFIG_FILE, body)

        self._send_json({"ok": True, "message": "Config saved"})

    def _api_reset_config(self) -> None:
        payload = json.loads(json.dumps(DEFAULT_CONFIG))
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        payload["created_at"] = payload["updated_at"]
        _save_json(CONFIG_FILE, payload)
        self._send_json({"ok": True, "message": "Config reset"})


def main() -> None:
    parser = argparse.ArgumentParser(description="QA dashboard server")
    parser.add_argument("--port", type=int, default=9090)
    parser.add_argument("--host", default="localhost")
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), Handler)
    print(f"QA dashboard: http://{args.host}:{args.port}")
    print(f"Config file : {CONFIG_FILE}")
    print(f"Reports dir : {REPORTS_DIR}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
