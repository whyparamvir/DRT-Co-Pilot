from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ai import build_context, generate_answer
from .config import ensure_storage, load_project_env
from .data_io import load_numeric_dataset, looks_like_npy, npy_to_csv_bytes, parse_dataset
from .models import AnalysisResult, ChatRequest, ChatResponse, DatasetSummary, RunAnalysisRequest
from .pydrt_adapter import run_simple_drt
from .storage import dataset_csv_path, load_analysis, load_dataset_summary, save_analysis, save_dataset


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_project_env()
    ensure_storage()
    yield


app = FastAPI(title="DRT Co-Pilot API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Local-first app: allow the dev server on any localhost port (Vite may fall back to 5174+).
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/datasets/upload", response_model=DatasetSummary)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetSummary:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    filename = file.filename or "dataset.csv"
    try:
        # .npy uploads are converted to the CSV layout pyDRTtools expects, then stored as CSV
        # so the rest of the pipeline (parsing, sign detection, analysis) is unchanged.
        if looks_like_npy(content, filename):
            content = npy_to_csv_bytes(content)
        summary = parse_dataset(content, filename)
        save_dataset(summary, content)
        return summary
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/analysis/run", response_model=AnalysisResult)
def run_analysis(payload: RunAnalysisRequest) -> AnalysisResult:
    try:
        dataset = load_dataset_summary(payload.dataset_id)
        df = load_numeric_dataset(dataset_csv_path(payload.dataset_id), dataset, payload.sign_convention)
        if df.empty:
            raise ValueError("No valid positive-frequency rows remain after parsing.")
        result = run_simple_drt(df, dataset, payload.sign_convention, payload.settings)
        save_analysis(result)
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DRT analysis failed: {exc}") from exc


@app.get("/api/analysis/{analysis_id}", response_model=AnalysisResult)
def get_analysis(analysis_id: str) -> AnalysisResult:
    try:
        return load_analysis(analysis_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    analysis = None
    dataset_context = None
    if payload.analysis_id:
        try:
            analysis = load_analysis(payload.analysis_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    elif payload.dataset_id:
        try:
            dataset_context = load_dataset_summary(payload.dataset_id).model_dump(mode="json")
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    return generate_answer(
        build_context(analysis, dataset_context),
        payload.message,
        payload.history,
        provider=payload.provider,
        model=payload.model,
        api_key=payload.api_key,
        base_url=payload.base_url,
    )
