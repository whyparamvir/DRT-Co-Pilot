"""Adapter around pyDRTtools for running simple DRT analyses.

The DRT computation itself is performed entirely by pyDRTtools, developed by
Prof. Francesco Ciucci and the ciuccislab (https://github.com/ciuccislab/pyDRTtools,
MIT License). This module only marshals data in/out of `EIS_object` and `simple_run`.
See the project README for the citations requested by the pyDRTtools authors.
"""

from __future__ import annotations

import contextlib
import io
import math
import sys
from uuid import uuid4

import numpy as np
import pandas as pd
from scipy.signal import find_peaks, peak_prominences, peak_widths

from .config import get_pydrttools_site
from .models import AnalysisResult, DatasetSummary, DRTSettings, Peak, PlotData, PlotSeries, ResidualMetrics, SignConvention


def _import_pydrttools():
    site = get_pydrttools_site()
    if site and site.exists() and str(site) not in sys.path:
        sys.path.insert(0, str(site))
    noisy_stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(noisy_stdout):
            from pyDRTtools.runs import EIS_object, simple_run
    except ImportError as exc:
        raise ValueError(
            f"Could not import pyDRTtools or one of its dependencies ({exc}). "
            "Install the backend requirements with `pip install -r backend/requirements.txt` "
            "and restart the API. See the README for details."
        ) from exc
    return EIS_object, simple_run


def _finite_float(value) -> float | None:
    try:
        val = float(value)
    except Exception:
        return None
    return val if math.isfinite(val) else None


def _residual_metrics(entry) -> ResidualMetrics | None:
    if not hasattr(entry, "res_re") or not hasattr(entry, "res_im"):
        return None
    res_re = np.asarray(entry.res_re, dtype=float)
    res_im = np.asarray(entry.res_im, dtype=float)
    return ResidualMetrics(
        rmse_real=float(np.sqrt(np.mean(res_re**2))),
        rmse_imag=float(np.sqrt(np.mean(res_im**2))),
        rmse_combined=float(np.sqrt(np.mean(np.concatenate([res_re, res_im]) ** 2))),
        max_abs_real=float(np.max(np.abs(res_re))),
        max_abs_imag=float(np.max(np.abs(res_im))),
    )


def _extract_peaks(tau: np.ndarray, gamma: np.ndarray) -> list[Peak]:
    if tau.size < 3 or gamma.size < 3 or float(np.nanmax(gamma)) <= 0:
        return []
    threshold = max(float(np.nanmax(gamma)) * 0.08, float(np.nanstd(gamma)) * 0.5)
    indices, _ = find_peaks(gamma, prominence=threshold)
    if indices.size == 0:
        indices = np.array([int(np.nanargmax(gamma))])

    prominences = peak_prominences(gamma, indices)[0] if indices.size else np.array([])
    widths = peak_widths(gamma, indices, rel_height=0.5)[0] if indices.size else np.array([])
    log_tau = np.log10(tau)
    peaks: list[Peak] = []
    for i, idx in enumerate(indices):
        width_tau = None
        if i < len(widths):
            left = max(0, idx - 1)
            delta = abs(log_tau[idx] - log_tau[left])
            width_tau = float(widths[i] * delta)
        peaks.append(
            Peak(
                tau=float(tau[idx]),
                frequency_hz=float(1.0 / tau[idx]),
                gamma=float(gamma[idx]),
                prominence=float(prominences[i]) if i < len(prominences) else None,
                width_tau=width_tau,
            )
        )
    return sorted(peaks, key=lambda p: p.gamma, reverse=True)[:8]


def _analysis_warnings(df: pd.DataFrame, gamma: np.ndarray, peaks: list[Peak], metrics: ResidualMetrics | None) -> list[str]:
    warnings: list[str] = []
    high_freq = df.head(max(3, min(8, len(df) // 10)))
    if len(high_freq) >= 3 and float(high_freq["z_imag"].median()) > 0:
        warnings.append("High-frequency imaginary impedance is positive after sign conversion; inductive behavior may be present.")
    if not peaks:
        warnings.append("No clear DRT peak was detected; try checking the sign convention or regularization settings.")
    if len(peaks) > 5:
        warnings.append("Many DRT peaks were detected; the result may be under-smoothed or noisy.")
    if gamma.size and float(np.nanmax(gamma)) > 0:
        small_tail = float(np.mean(gamma < 0.02 * np.nanmax(gamma)))
        if small_tail < 0.2:
            warnings.append("The DRT baseline is broadly elevated; consider stronger smoothing or data-quality checks.")
    if metrics and metrics.rmse_combined > 0:
        z_scale = float(np.nanmax(df["z_real"].to_numpy()) - np.nanmin(df["z_real"].to_numpy()))
        if z_scale > 0 and metrics.rmse_combined / z_scale > 0.1:
            warnings.append("Fit residuals are large relative to the impedance scale; inspect the fit and input format.")
    return warnings


def run_simple_drt(df: pd.DataFrame, dataset: DatasetSummary, sign_convention: SignConvention, settings: DRTSettings) -> AnalysisResult:
    EIS_object, simple_run = _import_pydrttools()
    entry = EIS_object(df["frequency"].to_numpy(float), df["z_real"].to_numpy(float), df["z_imag"].to_numpy(float))

    solver_output = io.StringIO()
    with contextlib.redirect_stdout(solver_output), contextlib.redirect_stderr(solver_output):
        entry = simple_run(
            entry,
            rbf_type=settings.rbf_type,
            data_used=settings.data_used,
            induct_used=settings.induct_used,
            der_used=settings.der_used,
            cv_type=settings.cv_type,
            reg_param=settings.reg_param,
            shape_control=settings.shape_control,
            coeff=settings.coeff,
        )

    tau = np.asarray(entry.out_tau_vec, dtype=float)
    gamma = np.asarray(entry.gamma, dtype=float)
    peaks = _extract_peaks(tau, gamma)
    metrics = _residual_metrics(entry)
    z_complex = df["z_real"].to_numpy(float) + 1j * df["z_imag"].to_numpy(float)
    magnitude = np.abs(z_complex)
    phase = np.angle(z_complex, deg=True)

    fit_series = None
    if hasattr(entry, "mu_Z_re") and hasattr(entry, "mu_Z_im"):
        fit_series = PlotSeries(
            x=[float(v) for v in np.asarray(entry.mu_Z_re, dtype=float)],
            y=[float(-v) for v in np.asarray(entry.mu_Z_im, dtype=float)],
        )

    warnings = _analysis_warnings(df, gamma, peaks, metrics)
    warnings.extend(dataset.warnings)
    return AnalysisResult(
        analysis_id=uuid4().hex,
        dataset=dataset,
        sign_convention=sign_convention,
        settings=settings,
        lambda_value=_finite_float(getattr(entry, "lambda_value", None)),
        resistance_ohm=_finite_float(getattr(entry, "R", None)),
        inductance_h=_finite_float(getattr(entry, "L", None)),
        residual_metrics=metrics,
        peaks=peaks,
        warnings=list(dict.fromkeys(warnings)),
        plot_data=PlotData(
            nyquist_measured=PlotSeries(x=[float(v) for v in df["z_real"]], y=[float(-v) for v in df["z_imag"]]),
            nyquist_fit=fit_series,
            bode_magnitude=PlotSeries(x=[float(v) for v in df["frequency"]], y=[float(v) for v in magnitude]),
            bode_phase=PlotSeries(x=[float(v) for v in df["frequency"]], y=[float(v) for v in phase]),
            drt=PlotSeries(x=[float(v) for v in tau], y=[float(v) for v in gamma]),
        ),
    )
