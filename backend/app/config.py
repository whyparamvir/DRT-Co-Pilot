from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
STORAGE_ROOT = PROJECT_ROOT / "storage"
UPLOADS_DIR = STORAGE_ROOT / "uploads"
RESULTS_DIR = STORAGE_ROOT / "results"
DEFAULT_PYDRTTOOLS_SITE = (PROJECT_ROOT.parent / "pyDRT" / ".venv" / "Lib" / "site-packages").resolve()


def load_project_env() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_pydrttools_site() -> Path | None:
    configured = os.getenv("PYDRTTOOLS_SITE_PACKAGES")
    if configured:
        path = Path(configured)
        if not path.is_absolute():
            path = (PROJECT_ROOT / path).resolve()
        return path
    if DEFAULT_PYDRTTOOLS_SITE.exists():
        return DEFAULT_PYDRTTOOLS_SITE
    return None


def ensure_storage() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
