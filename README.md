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
| **Ao vivo** | Cronômetro com duração configurável (ou livre) e limite de gols opcional, placar grande, gol com autor e assistência, desfazer, apito e vibração no fim do tempo, tela sempre acesa. O tempo vem do relógio do aparelho e não atrasa com a tela bloqueada. |
| **Jogos** | Placar ao vivo ou lançado depois. Sugere o próximo confronto no esquema "ganhou fica". Classificação da noite por time. |
| **Ranking** | Jogos, vitórias, empates, derrotas, gols, assistências e aproveitamento (V=3, E=1). Ranking geral e um ranking para cada horário fixo (dia da semana + início + fim, ex.: "Terça · 20h às 21h"). |
| **Avaliações** | Notas de 1 a 5 estrelas com comentário, públicas para todos (estilo Google Maps): média, distribuição e lista. Antispam por origem, campo-isca, sem links e limite por IP. |
| **Pix** | QR code para pagar o horário ou apoiar o desenvolvimento, com tela cheia e zoom, download e Pix copia e cola. |
| **Compartilhar** | Times e resultados formatados para o WhatsApp (compartilhamento nativo, copiar ou link `wa.me`). |
| **PWA** | Instalável em **Android** e **Windows/Mac** (botão "Instalar" no Chrome/Edge) e em **iPhone/iPad** (Safari → Compartilhar → Adicionar à Tela de Início, com instruções na tela). Atalhos para Nova partida e Ranking no ícone. Funciona offline depois do primeiro acesso. |
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

**Dados:** as partidas ficam no aparelho (localStorage). Só as **avaliações** são compartilhadas: ficam no **Cloudflare D1** e são servidas por uma Pages Function (`frontend/functions/api/reviews.ts`).

**Por que as partidas não usam backend:** todo o MVP roda no aparelho do usuário. Isso dá custo zero, funcionamento offline, nenhuma credencial para proteger e nenhum dado pessoal trafegando. Cloudflare Pages não executa FastAPI, e o OCR em Python exigiria um servidor com CPU dedicada. No navegador, ele roda de graça no próprio celular.

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

Projeto Pages `easyfoot` → **https://easyfoot.pages.dev**. Configuração em `frontend/wrangler.toml` (inclui o banco D1 `easyfoot-reviews`).

### Automático (GitHub Actions)

`.github/workflows/deploy.yml`: todo push na `main` roda testes, build, migrações do D1 e publica no Pages. Pull requests rodam só testes e build.

Segredos necessários no repositório (Settings → Secrets and variables → Actions):

| Segredo | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare (`npx wrangler whoami`) |
| `CLOUDFLARE_API_TOKEN` | Token com permissões **Account → Cloudflare Pages: Edit** e **Account → D1: Edit** |

### Manual

```bash
cd frontend
npx wrangler login   # uma vez
npm run deploy
```

O projeto foi criado como Pages clássico (`wrangler pages project create easyfoot --force`, uma única vez, porque o Wrangler 4 delega Pages para Workers por padrão).

### Avaliações: moderação

No painel do Cloudflare → D1 → `easyfoot-reviews` → Console:

```sql
SELECT id, name, rating, comment FROM reviews ORDER BY id DESC LIMIT 50;
UPDATE reviews SET hidden = 1 WHERE id = 123;  -- esconde uma avaliação
```

## Segurança

- Sem segredos no código: tokens do Cloudflare só existem como segredos do GitHub Actions.
- Avaliações: IP guardado apenas como hash (SHA-256 com sal), limite de 2 por dia, links bloqueados, campo-isca contra robôs e verificação de origem.
- `frontend/public/_headers` aplica CSP restritiva, `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`.
- A CSP libera apenas `cdn.jsdelivr.net` e `tessdata.projectnaptha.com`, que servem o motor e o idioma do OCR.
- Os dados ficam no `localStorage` do aparelho. O backup é um arquivo JSON local.

## Roadmap

Veja [docs/roadmap.md](docs/roadmap.md).

## Identidade visual

Veja [docs/identidade-visual.md](docs/identidade-visual.md).
