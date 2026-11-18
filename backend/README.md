# EasyFoot Backend (V2)

API base em FastAPI.

## Rodar

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Endpoint de saúde:

`GET /health`

O backend deve ser implantado em uma infraestrutura compatível com FastAPI/Python. Cloudflare Pages é destinado ao frontend; para levar a API para o ecossistema Cloudflare, o Cloud Code deve avaliar uma migração para Workers ou usar um runtime externo compatível.
