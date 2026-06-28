from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from .config import RESULTS_DIR, UPLOADS_DIR, ensure_storage
from .models import AnalysisResult, DatasetSummary


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_model(path: Path, model: BaseModel) -> None:
    _write_json(path, model.model_dump(mode="json"))


def dataset_meta_path(dataset_id: str) -> Path:
    return UPLOADS_DIR / f"{dataset_id}.json"


def dataset_csv_path(dataset_id: str) -> Path:
    return UPLOADS_DIR / f"{dataset_id}.csv"


def analysis_path(analysis_id: str) -> Path:
    return RESULTS_DIR / f"{analysis_id}.json"


def save_dataset(summary: DatasetSummary, csv_bytes: bytes) -> None:
    ensure_storage()
    dataset_csv_path(summary.dataset_id).write_bytes(csv_bytes)
    save_model(dataset_meta_path(summary.dataset_id), summary)


def load_dataset_summary(dataset_id: str) -> DatasetSummary:
    path = dataset_meta_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(f"Dataset {dataset_id} was not found.")
    return DatasetSummary.model_validate(_read_json(path))


def save_analysis(result: AnalysisResult) -> None:
    ensure_storage()
    save_model(analysis_path(result.analysis_id), result)


def load_analysis(analysis_id: str) -> AnalysisResult:
    path = analysis_path(analysis_id)
    if not path.exists():
        raise FileNotFoundError(f"Analysis {analysis_id} was not found.")
    return AnalysisResult.model_validate(_read_json(path))
