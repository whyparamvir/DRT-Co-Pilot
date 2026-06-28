from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SignConvention = Literal["z_imag", "neg_z_imag"]
AIProvider = Literal["mock", "openai", "gemini", "anthropic", "openai-compatible"]


class ColumnSummary(BaseModel):
    frequency: str
    z_real: str
    z_imag_input: str
    has_header: bool


class DatasetSummary(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    frequency_min: float
    frequency_max: float
    z_real_min: float
    z_real_max: float
    z_imag_input_min: float
    z_imag_input_max: float
    sign_convention_guess: SignConvention
    column_summary: ColumnSummary
    warnings: list[str] = Field(default_factory=list)


class DRTSettings(BaseModel):
    rbf_type: str = "Gaussian"
    data_used: str = "Combined Re-Im Data"
    induct_used: int = 1
    der_used: str = "1st order"
    cv_type: str = "GCV"
    reg_param: float = 1e-3
    shape_control: str = "FWHM Coefficient"
    coeff: float = 0.5


class RunAnalysisRequest(BaseModel):
    dataset_id: str
    sign_convention: SignConvention
    settings: DRTSettings = Field(default_factory=DRTSettings)


class Peak(BaseModel):
    tau: float
    frequency_hz: float
    gamma: float
    prominence: float | None = None
    width_tau: float | None = None


class ResidualMetrics(BaseModel):
    rmse_real: float
    rmse_imag: float
    rmse_combined: float
    max_abs_real: float
    max_abs_imag: float


class PlotSeries(BaseModel):
    x: list[float]
    y: list[float]


class PlotData(BaseModel):
    nyquist_measured: PlotSeries
    nyquist_fit: PlotSeries | None = None
    bode_magnitude: PlotSeries
    bode_phase: PlotSeries
    drt: PlotSeries


class AnalysisResult(BaseModel):
    analysis_id: str
    dataset: DatasetSummary
    sign_convention: SignConvention
    settings: DRTSettings
    lambda_value: float | None = None
    resistance_ohm: float | None = None
    inductance_h: float | None = None
    residual_metrics: ResidualMetrics | None = None
    peaks: list[Peak] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    plot_data: PlotData


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    dataset_id: str | None = None
    analysis_id: str | None = None
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    # Per-request AI overrides supplied by the local frontend so users can connect
    # their own provider/model/key in-app instead of editing backend .env.
    provider: AIProvider | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None


class ChatResponse(BaseModel):
    provider: AIProvider
    answer: str
    suggested_actions: list[str] = Field(default_factory=list)
