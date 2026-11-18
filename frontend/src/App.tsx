import { Component, type ReactNode } from "react";
import { StoreProvider, useRoute } from "./app/store";
import { Home } from "./screens/Home";
import { NewMatch } from "./screens/NewMatch";
import { MatchScreen } from "./screens/MatchScreen";
import { Ranking } from "./screens/Ranking";
import { InstallApp } from "./components/InstallApp";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (this.state.error) {
      return (
        <section className="panel">
          <div className="empty">
            <span aria-hidden>⚠️</span>
            <h3>Algo deu errado</h3>
            <p className="muted">Seus dados continuam salvos. Recarregue a página para continuar.</p>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function Screen() {
  const [page, id, tab] = useRoute();
  if (page === "nova") return <NewMatch />;
  if (page === "ranking") return <Ranking />;
  if (page === "partida" && id) return <MatchScreen key={id} id={id} tab={tab} />;
  return <Home />;
}

function Nav() {
  const [page] = useRoute();
  const cur = page || "inicio";
  const items: [string, string, string, string][] = [
    ["inicio", "#/", "Início", "⌂"],
    ["nova", "#/nova", "Nova", "+"],
    ["ranking", "#/ranking", "Ranking", "★"],
  ];
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {items.map(([k, href, label, icon]) => (
        <a key={k} href={href} aria-current={cur === k || (k === "inicio" && cur === "partida") ? "page" : undefined}>
          <span aria-hidden className="nav-icon">
            {icon}
          </span>
          {label}
        </a>
      ))}
    </nav>
  );
}

function TopBar() {
  const [page] = useRoute();
  if (!page) return null;
  return (
    <header className="topbar">
      <a href="#/" aria-label="EasyFoot — início">
        <img src="/assets/easyfoot-logo.webp" alt="EasyFoot" height={28} width={77} />
      </a>
      <InstallApp variant="compact" />
    </header>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ErrorBoundary>
        <TopBar />
        <main className="app">
          <Screen />
        </main>
        <Nav />
      </ErrorBoundary>
    </StoreProvider>
  );
}
