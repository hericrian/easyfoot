# Arquitetura

## V1 (em produção): PWA sem servidor

```text
Usuário ──▶ easyfoot.pages.dev (Cloudflare Pages, estático)
              │
              ▼
          PWA React no navegador
              ├── Parser da lista (texto ou OCR)
              ├── OCR: tesseract.js em Web Worker (motor e idioma via jsDelivr na 1ª vez)
              ├── Sorteio / Draft
              ├── Jogos e Ranking
              └── localStorage  ◀──▶  Backup JSON (exportar/importar)
```

### Decisões

| Decisão | Motivo |
| --- | --- |
| Tudo no cliente | O MVP não precisa compartilhar dados entre usuários. Assim o custo é zero, há offline e nenhum dado pessoal sai do aparelho. |
| OCR no navegador | Dispensa API paga e servidor com CPU. O usuário sempre revisa o texto extraído antes do sorteio. |
| Rotas por hash (`#/partida/:id`) | Funciona em qualquer host estático sem regra de rewrite e deixa o deep link do PWA confiável. |
| Snapshot dos jogadores em cada jogo | Re-sortear ou editar a lista não altera jogos já registrados nem o ranking. |
| Ranking por nome normalizado | O mesmo jogador em partidas diferentes ("João", "joao", "JOÃO") soma no mesmo registro. |
| Service worker simples | Navegação usa rede primeiro, para sempre pegar a versão nova. Assets com hash usam cache primeiro. |

## V2 (planejada): dados compartilhados

Quando o grupo quiser um ranking único entre vários celulares:

1. **Cloudflare Workers (TypeScript) + D1 (SQLite)**: mesma plataforma, plano gratuito e sem servidor para manter. A lógica de `src/lib` já é TypeScript pura e pode ser reaproveitada no Worker.
2. Alternativa: manter o **FastAPI** de `backend/` num runtime de container (Fly.io, Render, Cloud Run) com **Supabase/PostgreSQL** (`database/schema.sql`). Nesse caso, configurar `CORS_ORIGINS=https://easyfoot.pages.dev`.

O FastAPI tradicional **não** roda no Cloudflare Pages.
