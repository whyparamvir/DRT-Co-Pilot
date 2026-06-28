from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd

from .models import ColumnSummary, DatasetSummary, SignConvention


HEADER_HINTS = {
    "frequency": ("freq", "frequency", "hz", "f"),
    "z_real": ("z_re", "zreal", "z_real", "real", "z'", "re"),
    "z_imag": ("z_im", "zimag", "z_imag", "imag", "z''", "-z", "im"),
}


def _looks_numeric_frame(df: pd.DataFrame) -> bool:
    if df.empty or df.shape[1] < 3:
        return False
    sample = df.iloc[: min(5, len(df)), :3]
    converted = sample.apply(pd.to_numeric, errors="coerce")
    return converted.notna().mean().mean() > 0.8


def _read_csv_bytes(content: bytes) -> tuple[pd.DataFrame, bool]:
    header_df = pd.read_csv(BytesIO(content))
    numeric_column_names = pd.to_numeric(pd.Index(header_df.columns), errors="coerce").notna().mean() > 0.5
    if _looks_numeric_frame(header_df) and not numeric_column_names:
        return header_df, True
    no_header_df = pd.read_csv(BytesIO(content), header=None)
    if not _looks_numeric_frame(no_header_df):
        raise ValueError("CSV must contain at least three numeric columns: frequency, Z_real, and Z_imag or -Z_imag.")
    no_header_df.columns = ["frequency", "z_real", "z_imag_input"] + [
        f"extra_{i}" for i in range(4, no_header_df.shape[1] + 1)
    ]
    return no_header_df, False


def _find_column(df: pd.DataFrame, role: str, fallback_index: int, exclude: tuple[str, ...] = ()) -> str:
    all_cols = [str(c) for c in df.columns]
    excluded = set(exclude)
    candidates = [c for c in all_cols if c not in excluded]
    lowered = {c: c.lower().replace(" ", "").replace("-", "_") for c in candidates}
    hints = HEADER_HINTS[role]
    # Pass 1: exact / prefix match so "frequency" can't be claimed by z_real's "re" substring.
    for col, low in lowered.items():
        if any(low == hint or low.startswith(hint) for hint in hints):
            return col
    # Pass 2: looser substring match, still on non-excluded columns only.
    for col, low in lowered.items():
        if any(hint in low for hint in hints):
            return col
    # Positional fallback, never returning an already-claimed column.
    if fallback_index < len(all_cols) and all_cols[fallback_index] not in excluded:
        return all_cols[fallback_index]
    return candidates[0] if candidates else all_cols[fallback_index]


def guess_sign_convention(z_imag_input: np.ndarray) -> SignConvention:
    finite = z_imag_input[np.isfinite(z_imag_input)]
    if finite.size == 0:
        return "neg_z_imag"
    positive_fraction = float(np.mean(finite >= 0))
    return "neg_z_imag" if positive_fraction >= 0.6 else "z_imag"


def build_warnings(freq: np.ndarray, z_re: np.ndarray, z_im_input: np.ndarray, guess: SignConvention) -> list[str]:
    warnings: list[str] = []
    if len(freq) < 10:
        warnings.append("Very few frequency points were found; DRT results may be poorly resolved.")
    if np.any(freq <= 0):
        warnings.append("Frequency values must be positive; non-positive rows will make analysis invalid.")
    if not (np.all(np.diff(freq) <= 0) or np.all(np.diff(freq) >= 0)):
        warnings.append("Frequencies are not monotonic; they will be sorted before analysis.")
    if np.nanmax(freq) / max(np.nanmin(freq), 1e-30) < 100:
        warnings.append("Frequency span is narrow; DRT peak separation may be limited.")
    if guess == "neg_z_imag" and np.nanmedian(z_im_input) < 0:
        warnings.append("Imaginary column sign is ambiguous; verify whether the third column is Z_imag or -Z_imag.")
    if np.nanstd(z_re) == 0:
        warnings.append("Real impedance column is nearly constant; check that the file columns are correct.")
    return warnings


NPY_MAGIC = b"\x93NUMPY"


def looks_like_npy(content: bytes, filename: str) -> bool:
    """True for NumPy .npy uploads, detected by extension or the .npy magic header."""
    return filename.lower().endswith(".npy") or content[:6] == NPY_MAGIC


def _extract_eis_columns(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Pull (frequency, Z_real, Z_imag) out of a loaded NumPy EIS array.

    Accepts real arrays with >=3 columns [freq, Z', Z''] and complex arrays
    shaped [freq, Z] where Z is complex. Either orientation (points as rows or
    columns) is handled by treating the longer axis as the list of points.
    """
    if arr.dtype.names:  # structured array -> stack named fields in order
        arr = np.column_stack([np.asarray(arr[name]) for name in arr.dtype.names])
    arr = np.squeeze(np.asarray(arr))

    if arr.ndim == 1:
        raise ValueError(
            "The .npy file holds a single 1-D array. Expected a 2-D array with frequency, "
            "Z_real and Z_imag (or frequency and a complex impedance)."
        )
    if arr.ndim != 2:
        raise ValueError(f"Expected a 2-D EIS array in the .npy file, got shape {arr.shape}.")

    # EIS spectra have many points and few channels, so the longer axis is the points axis.
    if arr.shape[0] < arr.shape[1]:
        arr = arr.T
    ncols = arr.shape[1]

    if np.iscomplexobj(arr):
        if ncols < 2:
            raise ValueError("Complex .npy array needs a frequency column plus a complex impedance column.")
        freq = np.real(arr[:, 0]).astype(float)
        z = arr[:, 1].astype(complex)
        return freq, np.real(z).astype(float), np.imag(z).astype(float)

    if ncols < 3:
        raise ValueError(
            "Real .npy array needs at least 3 columns: frequency, Z_real, Z_imag. "
            f"Found {ncols} column(s)."
        )
    return arr[:, 0].astype(float), arr[:, 1].astype(float), arr[:, 2].astype(float)


def npy_to_csv_bytes(content: bytes) -> bytes:
    """Convert an uploaded .npy EIS array into the headered CSV pyDRTtools expects."""
    try:
        arr = np.load(BytesIO(content), allow_pickle=False)
    except Exception as exc:  # malformed / pickled / non-array payloads
        raise ValueError(f"Could not read the .npy file: {exc}") from exc

    freq, z_re, z_im = _extract_eis_columns(arr)
    n = min(len(freq), len(z_re), len(z_im))
    frame = pd.DataFrame({"frequency": freq[:n], "Z_real": z_re[:n], "Z_imag": z_im[:n]})
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    if frame.empty:
        raise ValueError("The .npy file contained no finite EIS rows after conversion.")

    buffer = BytesIO()
    frame.to_csv(buffer, index=False)
    return buffer.getvalue()


def parse_dataset(content: bytes, filename: str) -> DatasetSummary:
    df, has_header = _read_csv_bytes(content)
    if df.shape[1] < 3:
        raise ValueError("CSV must include at least three columns.")

    freq_col = _find_column(df, "frequency", 0)
    z_re_col = _find_column(df, "z_real", 1, exclude=(freq_col,))
    z_im_col = _find_column(df, "z_imag", 2, exclude=(freq_col, z_re_col))

    numeric = pd.DataFrame(
        {
            "frequency": pd.to_numeric(df[freq_col], errors="coerce"),
            "z_real": pd.to_numeric(df[z_re_col], errors="coerce"),
            "z_imag_input": pd.to_numeric(df[z_im_col], errors="coerce"),
        }
    ).dropna()
    if numeric.empty:
        raise ValueError("No valid numeric EIS rows were found.")

    freq = numeric["frequency"].to_numpy(float)
    z_re = numeric["z_real"].to_numpy(float)
    z_im_input = numeric["z_imag_input"].to_numpy(float)
    guess = guess_sign_convention(z_im_input)

    return DatasetSummary(
        dataset_id=uuid4().hex,
        filename=Path(filename).name,
        rows=int(len(numeric)),
        frequency_min=float(np.nanmin(freq)),
        frequency_max=float(np.nanmax(freq)),
        z_real_min=float(np.nanmin(z_re)),
        z_real_max=float(np.nanmax(z_re)),
        z_imag_input_min=float(np.nanmin(z_im_input)),
        z_imag_input_max=float(np.nanmax(z_im_input)),
        sign_convention_guess=guess,
        column_summary=ColumnSummary(
            frequency=str(freq_col),
            z_real=str(z_re_col),
            z_imag_input=str(z_im_col),
            has_header=has_header,
        ),
        warnings=build_warnings(freq, z_re, z_im_input, guess),
    )


def load_numeric_dataset(csv_path: Path, summary: DatasetSummary, sign_convention: SignConvention) -> pd.DataFrame:
    content = csv_path.read_bytes()
    df, _ = _read_csv_bytes(content)
    cols = summary.column_summary
    numeric = pd.DataFrame(
        {
            "frequency": pd.to_numeric(df[cols.frequency], errors="coerce"),
            "z_real": pd.to_numeric(df[cols.z_real], errors="coerce"),
            "z_imag_input": pd.to_numeric(df[cols.z_imag_input], errors="coerce"),
        }
    ).dropna()
    numeric = numeric[numeric["frequency"] > 0].copy()
    if sign_convention == "neg_z_imag":
        numeric["z_imag"] = -numeric["z_imag_input"]
    else:
        numeric["z_imag"] = numeric["z_imag_input"]
    numeric = numeric.sort_values("frequency", ascending=False).reset_index(drop=True)
    return numeric
