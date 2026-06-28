from __future__ import annotations

import json
import os
from typing import Any
from urllib import error, request

from .config import load_project_env
from .models import AnalysisResult, ChatMessage, ChatResponse

load_project_env()

SYSTEM_PROMPT = """You are DRT Co-Pilot, a beginner-friendly assistant for electrochemical impedance spectroscopy and DRT analysis.
Use only the structured analysis facts provided by the backend for numerical claims.
Be helpful and concrete, but conservative: DRT peaks suggest possible processes, they do not prove mechanisms without domain context.
Keep answers short, practical and action-oriented. When relevant, suggest a concrete next analysis the user could run."""


def build_context(analysis: AnalysisResult | None, dataset: dict[str, Any] | None = None) -> dict[str, Any]:
    if analysis:
        payload = analysis.model_dump(mode="json")
        drt = payload.get("plot_data", {}).get("drt", {})
        payload["plot_data"]["drt"] = {
            "tau_min": min(drt.get("x", []) or [0]),
            "tau_max": max(drt.get("x", []) or [0]),
            "gamma_max": max(drt.get("y", []) or [0]),
            "points": len(drt.get("x", [])),
        }
        return payload
    return dataset or {}


def _prompt(context: dict[str, Any], message: str, history: list[ChatMessage]) -> str:
    transcript = "\n".join(f"{m.role}: {m.content}" for m in history[-8:])
    return (
        f"{SYSTEM_PROMPT}\n\nAnalysis context JSON:\n{json.dumps(context)[:12000]}\n\n"
        f"Recent chat:\n{transcript}\n\nUser: {message}"
    )


def _mock_answer(context: dict[str, Any]) -> ChatResponse:
    if not context:
        answer = "Upload an EIS CSV and run DRT first. Then I can explain peaks, lambda, fit quality, and what to try next."
    else:
        peaks = context.get("peaks", [])
        settings = context.get("settings", {})
        peak_text = "No clear peaks were detected yet."
        if peaks:
            peak_text = "Detected main DRT peaks at " + ", ".join(
                f"tau={p['tau']:.2e} s (gamma={p['gamma']:.3g})" for p in peaks[:3]
            ) + "."
        answer = (
            f"{peak_text} The run used {settings.get('rbf_type', 'the selected RBF')} with "
            f"{settings.get('der_used', 'the selected derivative penalty')} and lambda={context.get('lambda_value')}. "
            "First verify the sign convention, then compare a 2nd-order run before assigning small peaks to physical processes."
        )
    return ChatResponse(
        provider="mock",
        answer=answer,
        suggested_actions=[
            "Verify whether column 3 is Z_imag or -Z_imag.",
            "Try 2nd-order regularization and compare peak stability.",
            "Inspect fit residuals before interpreting small peaks.",
        ],
    )


def _post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={**headers, "Content-Type": "application/json"}, method="POST")
    with request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _openai_answer(context, message, history, *, api_key, model, base_url, provider="openai") -> ChatResponse:
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return ChatResponse(provider=provider, answer="No OpenAI API key was provided. Connect a model in the app or set OPENAI_API_KEY.")
    model = model or os.getenv("AI_MODEL") or "gpt-4.1-mini"
    root = (base_url or "https://api.openai.com/v1").rstrip("/")
    # Chat Completions is the most widely supported surface across OpenAI-compatible servers.
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _prompt(context, message, history)},
        ],
    }
    data = _post_json(f"{root}/chat/completions", {"Authorization": f"Bearer {api_key}"}, payload)
    choices = data.get("choices", [])
    answer = ""
    if choices:
        answer = choices[0].get("message", {}).get("content", "") or ""
    return ChatResponse(provider=provider, answer=answer or "The model returned no text.")


def _gemini_answer(context, message, history, *, api_key, model) -> ChatResponse:
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ChatResponse(provider="gemini", answer="No Gemini API key was provided. Connect a model in the app or set GEMINI_API_KEY.")
    model = model or os.getenv("AI_MODEL") or "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    data = _post_json(url, {}, {"contents": [{"parts": [{"text": _prompt(context, message, history)}]}]})
    candidates = data.get("candidates", [])
    text = ""
    if candidates:
        text = "\n".join(part.get("text", "") for part in candidates[0].get("content", {}).get("parts", []))
    return ChatResponse(provider="gemini", answer=text or "Gemini returned no text.")


def _anthropic_answer(context, message, history, *, api_key, model) -> ChatResponse:
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(provider="anthropic", answer="No Anthropic API key was provided. Connect a model in the app or set ANTHROPIC_API_KEY.")
    model = model or os.getenv("AI_MODEL") or "claude-3-5-haiku-latest"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    payload = {
        "model": model,
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": _prompt(context, message, history)}],
    }
    data = _post_json("https://api.anthropic.com/v1/messages", headers, payload)
    blocks = data.get("content", [])
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    return ChatResponse(provider="anthropic", answer=text or "Claude returned no text.")


def generate_answer(
    context: dict[str, Any],
    message: str,
    history: list[ChatMessage],
    *,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> ChatResponse:
    provider = (provider or os.getenv("AI_PROVIDER") or "mock").lower()
    try:
        if provider == "openai":
            return _openai_answer(context, message, history, api_key=api_key, model=model, base_url=base_url)
        if provider == "openai-compatible":
            return _openai_answer(
                context, message, history, api_key=api_key, model=model, base_url=base_url, provider="openai-compatible"
            )
        if provider == "gemini":
            return _gemini_answer(context, message, history, api_key=api_key, model=model)
        if provider == "anthropic":
            return _anthropic_answer(context, message, history, api_key=api_key, model=model)
        return _mock_answer(context)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return ChatResponse(provider=provider, answer=f"The AI provider request failed ({exc.code}): {detail[:500]}")
    except Exception as exc:
        return ChatResponse(provider=provider, answer=f"The AI provider failed locally: {exc}")
