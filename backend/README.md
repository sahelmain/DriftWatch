# DriftWatch — Backend

FastAPI API and Celery worker code for [DriftWatch](../README.md).

## Run API locally

From the **repository root**:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

API docs: `http://localhost:8000/api/docs`

## Env

See [`.env.example`](.env.example) and the root [README](../README.md#configuration).
