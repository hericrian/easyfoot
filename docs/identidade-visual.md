# Identidade visual — EasyFoot

## Logo

Escrita **EASY FOOT** em **Saira Black Italic** (SIL Open Font License), convertida em curvas. As duas bolas substituem os "O" de FOOT. Não há arcos nem traços de velocidade: só a escrita.

As bolas são geradas a partir da geometria real de uma bola de futebol (icosaedro truncado projetado numa esfera), com gomos e costuras curvos e contorno grosso. Assim ficam nítidas de 16 px a qualquer tamanho.

| Arquivo | Uso |
| --- | --- |
| `frontend/public/assets/easyfoot-logo.svg` | Logo empilhada (tela inicial) |
| `frontend/public/assets/easyfoot-logo-inline.svg` | Logo em linha (barra superior) |
| `frontend/brand/easyfoot-logo-ink.svg` | Versão escura para fundos claros |
| `frontend/public/icons/*.png` | Ícones do PWA (a bola), maskable e imagem de compartilhamento |
| `frontend/brand/futeasy-logo.png` | Logo original de referência |

Para regenerar tudo:

```bash
cd frontend
npm run brand
```

## Interface

Inspirada nas diretrizes de design da Apple:

- Fonte do sistema (SF no iPhone/Mac, Segoe no Windows), com tracking que muda conforme o tamanho.
- Cores semânticas em camadas: fundo agrupado, superfícies elevadas e rótulos primário, secundário e terciário, com modo claro e escuro.
- Barras superior e inferior translúcidas (material com desfoque), sheets com mola criticamente amortecida e retorno imediato no toque.
- Ícones de traço próprios no lugar de emojis.
- Respeita "reduzir movimento", "reduzir transparência" e "aumentar contraste" do sistema.
- Paleta monocromática da marca. A cor aparece só onde informa algo: vermelho no "ao vivo", verde no play e nos interruptores, amarelo no fim de tempo e as cores dos coletes dos times.
