# ⚽ EasyFoot

**Organize. Sorteie. Jogue.**

Produção: **https://easyfoot.pages.dev**

O EasyFoot transforma a lista da pelada que fica perdida no WhatsApp em uma partida organizada: jogadores, goleiros, sorteio ou draft dos times, placar, artilharia e ranking.

> abrir → colar a lista → revisar → sortear → jogar

## Funcionalidades

| Etapa | O que faz |
| --- | --- |
| **Partida** | Nome, local, data e horário. Editável a qualquer momento. |
| **Lista** | Cola a lista do WhatsApp ou envia print(s). O parser entende numeração (`1.`, `2-`, `3)`), emojis, `✅`, `(pago)`, seções `Goleiros:` e `Reservas:` e o prefixo de exportação do WhatsApp. Ignora data, horário, links e avisos. |
| **OCR** | Leitura de prints 100% no navegador com [tesseract.js](https://github.com/naptha/tesseract.js) (open source, sem API paga). Prints em modo escuro são invertidos automaticamente. O texto extraído aparece para revisão antes de virar lista. |
| **Goleiros** | Detectados por 🧤, 🥅, `goleiro`, `gol`, `gk`, `(G)` ou pela seção `Goleiros:`. Tudo pode ser corrigido com um toque. |
| **Sorteio** | Um goleiro por time, linha distribuída com diferença máxima de 1 jogador. Opcional: equilibrar pelo aproveitamento do ranking. |
| **Draft** | Capitães escolhidos à mão ou sorteados, par ou ímpar (ou sorteio para 3+ times), ordem alternada ou serpentina, goleiros separados opcionalmente, desfazer escolha. |
| **Ajustes** | Trocar jogador de time, renomear times e escolher cor do colete. |
| **Jogos** | Placar por gols de cada jogador + gols contra. Sugere o próximo confronto no esquema "ganhou fica". Classificação da noite por time. |
| **Ranking** | Jogos, vitórias, empates, derrotas, gols e aproveitamento (V=3, E=1). |
| **Compartilhar** | Times e resultados formatados para o WhatsApp (compartilhamento nativo, copiar ou link `wa.me`). |
| **PWA** | Instalável no celular e funciona offline depois do primeiro acesso. |
| **Backup** | Exportar/importar JSON para guardar ou trocar de aparelho. |

## Arquitetura

```text
Cloudflare Pages (estático, CDN global)
└── PWA React + TypeScript (Vite)
    ├── parser da lista        src/lib/parser.ts
    ├── OCR no navegador       src/lib/ocr.ts      (carregado sob demanda)
    ├── sorteio / draft        src/lib/draw.ts
    ├── ranking                src/lib/ranking.ts
    └── persistência local     src/lib/store.ts    (localStorage + backup JSON)
```

**Por que não há backend em produção:** todo o MVP roda no aparelho do usuário. Isso dá custo zero, funcionamento offline, nenhuma credencial para proteger e nenhum dado pessoal trafegando. Cloudflare Pages não executa FastAPI, e o OCR em Python exigiria um servidor com CPU dedicada. No navegador, ele roda de graça no próprio celular.

A pasta `backend/` (FastAPI) e `database/schema.sql` ficam como base para a V2 (login, grupos e ranking compartilhado). O caminho recomendado está em [docs/arquitetura.md](docs/arquitetura.md).

## Estrutura

```text
easyfoot/
├── frontend/              # PWA (o que vai para produção)
│   ├── src/
│   │   ├── app/           # estado global, rotas por hash, toasts
│   │   ├── components/    # Stepper, Sheet (dialog), etc.
│   │   ├── lib/           # regras de negócio puras e testadas
│   │   └── screens/       # Início, Nova partida, Partida (Lista/Times/Jogos), Ranking
│   ├── public/            # manifest, service worker, ícones, _headers (CSP)
│   ├── tests/             # testes do parser, sorteio, draft e ranking
│   └── brand/             # logo original em alta resolução
├── backend/               # FastAPI (V2, não publicado)
├── database/              # schema SQL (V2)
└── docs/
```

## Desenvolvimento

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm test             # testes (Vitest)
npm run build        # typecheck + build de produção em dist/
npm run pages:dev    # simula o Cloudflare Pages localmente (com _headers/CSP)
```

## Deploy (Cloudflare Pages)

Projeto Pages: `easyfoot` → domínio `easyfoot.pages.dev`.

```bash
cd frontend
npx wrangler login   # uma vez
npm run deploy       # build + wrangler pages deploy dist --project-name easyfoot --branch main
```

Para deploy automático a cada push, conecte este repositório ao projeto no painel do Cloudflare (Workers & Pages → easyfoot → Settings → Builds) com:

| Campo | Valor |
| --- | --- |
| Diretório raiz | `frontend` |
| Comando de build | `npm run build` |
| Diretório de saída | `dist` |
| Branch de produção | `main` |

Não há variáveis de ambiente nem segredos em produção.

## Segurança

- Sem segredos no código: o app não usa chaves nem tokens.
- `frontend/public/_headers` aplica CSP restritiva, `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`.
- A CSP libera apenas `cdn.jsdelivr.net` e `tessdata.projectnaptha.com`, que servem o motor e o idioma do OCR.
- Os dados ficam no `localStorage` do aparelho. O backup é um arquivo JSON local.

## Roadmap

Veja [docs/roadmap.md](docs/roadmap.md).

## Identidade visual

Veja [docs/identidade-visual.md](docs/identidade-visual.md).
