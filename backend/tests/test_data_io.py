from __future__ import annotations

from io import BytesIO

import numpy as np
import pytest

from app.data_io import guess_sign_convention, npy_to_csv_bytes, parse_dataset


def test_parse_headerless_csv():
    content = b"1000,10,1\n100,12,2\n10,20,5\n"
    summary = parse_dataset(content, "sample.csv")
    assert summary.rows == 3
    assert summary.column_summary.has_header is False
    assert summary.sign_convention_guess == "neg_z_imag"


def test_parse_headered_csv():
    content = b"freq,z_re,z_im\n1000,10,-1\n100,12,-2\n10,20,-5\n"
    summary = parse_dataset(content, "sample.csv")
    assert summary.rows == 3
    assert summary.column_summary.has_header is True
    assert summary.sign_convention_guess == "z_imag"


def test_sign_convention_guess():
    assert guess_sign_convention(np.array([1, 2, 3])) == "neg_z_imag"
    assert guess_sign_convention(np.array([-1, -2, 1])) == "z_imag"


def test_frequency_column_not_claimed_by_z_real():
    # Header "freq" contains the "re" substring; z_real must not collapse onto it.
    content = b"freq,z_re,neg_z_im\n1000,10,1\n100,12,2\n10,20,5\n"
    summary = parse_dataset(content, "sample.csv")
    cols = summary.column_summary
    assert cols.frequency == "freq"
    assert cols.z_real == "z_re"
    assert cols.z_imag_input == "neg_z_im"


def _npy_bytes(arr: np.ndarray) -> bytes:
    buffer = BytesIO()
    np.save(buffer, arr)
    return buffer.getvalue()


def test_npy_real_three_columns():
    arr = np.array([[1000.0, 10.0, 1.0], [100.0, 12.0, 2.0], [10.0, 20.0, 5.0]])
    csv = npy_to_csv_bytes(_npy_bytes(arr))
    summary = parse_dataset(csv, "spectrum.npy")
    assert summary.rows == 3
    assert summary.column_summary.frequency == "frequency"
    assert summary.column_summary.z_real == "Z_real"
    assert summary.frequency_max == 1000.0


def test_npy_transposed_is_reoriented():
    # Channels-as-rows (3, N) should be transposed back to points-as-rows.
    arr = np.array([[1000.0, 100.0, 10.0, 1.0], [10.0, 12.0, 20.0, 25.0], [1.0, 2.0, 5.0, 8.0]])
    csv = npy_to_csv_bytes(_npy_bytes(arr))
    summary = parse_dataset(csv, "spectrum.npy")
    assert summary.rows == 4


def test_npy_complex_array():
    freq = np.array([1000.0, 100.0, 10.0])
    z = np.array([10 - 1j, 12 - 2j, 20 - 5j])
    arr = np.column_stack([freq, z])  # complex 2-column array
    csv = npy_to_csv_bytes(_npy_bytes(arr))
    summary = parse_dataset(csv, "spectrum.npy")
    assert summary.rows == 3
    # Imaginary parts are negative -> third column is true Z_imag.
    assert summary.sign_convention_guess == "z_imag"


def test_npy_one_dimensional_rejected():
    with pytest.raises(ValueError):
        npy_to_csv_bytes(_npy_bytes(np.array([1.0, 2.0, 3.0])))
