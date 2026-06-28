# DRT Co-Pilot

DRT Co-Pilot is a local web app for analyzing electrochemical impedance spectroscopy (EIS)
data with the distribution of relaxation times (DRT). You upload a spectrum, the app runs
DRT through [pyDRTtools](https://github.com/ciuccislab/pyDRTtools), and a chat assistant
helps interpret the result. It is aimed at people who are new to DRT and want a guided
workflow rather than a bare scientific tool.

The assistant only explains values computed by the backend. It does not generate or guess
DRT results.

## Features

- Upload EIS data as CSV or NumPy `.npy`, with or without a header. The app detects the sign
  convention of the imaginary column and asks you to confirm it.
- The assistant suggests analyses (a basic DRT run, first vs second derivative regularization,
  inductance on/off, lambda selection). You pick which to run, and nothing is computed until
  you confirm.
- Results include Nyquist, Bode and DRT plots, a peak table, residual metrics and warnings.
- Chat answers come from a built-in offline assistant (no key needed) or from a provider you
  connect in the app: OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint. Keys are
  stored in the browser only.

## Requirements

- Python 3.11, 3.12 or 3.13
- Node.js 20 or newer

The backend installs pyDRTtools, which also pulls in PyQt5, cvxopt, scikit-learn and
matplotlib. The first install can take a few minutes.

## Running the backend

Windows (PowerShell):

```powershell
git clone https://github.com/whyparamvir/DRT-Co-Pilot.git
cd DRT-Co-Pilot
py -3.12 -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --reload
```

macOS / Linux:

```bash
git clone https://github.com/whyparamvir/DRT-Co-Pilot.git
cd DRT-Co-Pilot
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

The API runs at http://127.0.0.1:8000 and serves interactive docs at `/docs`.

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 and upload a spectrum. Sample files are in `storage/samples`.

## Connecting an AI model 

To use a hosted model, open the model selector at the bottom of the chat, choose a provider (OpenAI, Anthropic, Gemini, or a
custom OpenAI-compatible endpoint), paste your key and pick a model. Keys stay in the browser
(in the tab by default, or in local storage if you choose to remember them) and are sent only
to your local backend and the provider you selected.

You can also set a default provider through environment variables; see `.env.example`.

## Input format

One spectrum with three columns: frequency, Z_real, and either Z_imag or -Z_imag.

- CSV: with or without a header row.
- NumPy `.npy`: a real array with at least three columns `[frequency, Z_real, Z_imag]`, or a
  complex array with two columns `[frequency, Z]` where `Z = Z_real + 1j*Z_imag`. Both row-
  and column-major layouts are handled. The backend converts `.npy` input to the CSV layout
  above before analysis.

## Project layout

```text
backend/
  app/
    main.py           FastAPI routes
    models.py         request/response schemas
    data_io.py        CSV/.npy parsing and sign detection
    pydrt_adapter.py  pyDRTtools wrapper
    ai.py             chat provider layer
    storage.py        local dataset/result storage
    config.py
  tests/
  requirements.txt
frontend/
  src/
    components/       chat, cards, charts, panels, model UI
    agent/            analysis action definitions
    store/            local model connections
    App.tsx
storage/samples/      example spectra
```

## Tests

```bash
# backend (use Scripts/python.exe on Windows, bin/python on macOS/Linux)
backend/.venv/bin/python -m pytest backend/tests

# frontend type-check and build
cd frontend && npm run build
```

## Credits

DRT computation is performed by [pyDRTtools](https://github.com/ciuccislab/pyDRTtools),
developed by Francesco Ciucci and co-workers, and released under the MIT license. DRT Co-Pilot
is an independent interface and is not affiliated with or endorsed by the pyDRTtools authors.

If you use this for academic work, cite the pyDRTtools papers relevant to the features you use:

- T. H. Wan, M. Saccoccio, C. Chen, F. Ciucci. Influence of the discretization methods on the distribution of relaxation times deconvolution. Electrochimica Acta 184 (2015) 483-499. https://doi.org/10.1016/j.electacta.2015.09.097
- A. Maradesa, B. Py, T. H. Wan, M. B. Effat, F. Ciucci. Selecting the Regularization Parameter in the Distribution of Relaxation Times. Journal of The Electrochemical Society 170 (2023) 030502. https://doi.org/10.1149/1945-7111/acbca4
- F. Ciucci, C. Chen. Analysis of impedance data using the distribution of relaxation times. Electrochimica Acta 167 (2015) 439-454. https://doi.org/10.1016/j.electacta.2015.03.123
- M. B. Effat, F. Ciucci. Bayesian and hierarchical Bayesian based regularization for DRT. Electrochimica Acta 247 (2017) 1117-1129. https://doi.org/10.1016/j.electacta.2017.07.050
- J. Liu, T. H. Wan, F. Ciucci. Hilbert transform and Kramers-Kronig analysis of impedance data. Electrochimica Acta 357 (2020) 136864. https://doi.org/10.1016/j.electacta.2020.136864

## License

MIT. See [LICENSE](LICENSE).

## Note

DRT peaks indicate time-scale features in the data. They do not by themselves prove a
physical mechanism; interpretation needs system context, controls and validation. The
assistant is deliberately cautious and suggests checks (sign convention, regularization,
residuals) before drawing conclusions.
