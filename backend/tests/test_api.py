from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_upload_and_mock_chat():
    client = TestClient(app)
    csv = b"freq,z_re,neg_z_im\n1000,10,1\n100,12,2\n10,20,5\n"
    upload = client.post("/api/datasets/upload", files={"file": ("sample.csv", csv, "text/csv")})
    assert upload.status_code == 200
    dataset_id = upload.json()["dataset_id"]
    chat = client.post(
        "/api/chat",
        json={"dataset_id": dataset_id, "message": "Explain this like I am new to EIS.", "history": []},
    )
    assert chat.status_code == 200
    assert "frequency" in chat.json()["answer"] or "peaks" in chat.json()["answer"]
