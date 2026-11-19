import { Component, type ReactNode } from "react";
import { StoreProvider, useRoute, useStore } from "./app/store";
import { Home } from "./screens/Home";
import { NewMatch } from "./screens/NewMatch";
import { MatchScreen } from "./screens/MatchScreen";
import { Ranking } from "./screens/Ranking";
import { InstallApp } from "./components/InstallApp";
import { IconHome, IconPlusCircle, IconTrophy } from "./components/icons";

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
  const { db } = useStore();
  const live = db.matches.some((m) => m.live);
  const cur = page || "inicio";
  const items: [string, string, string, ReactNode][] = [
    ["inicio", "#/", "Partidas", <IconHome key="h" />],
    ["nova", "#/nova", "Nova", <IconPlusCircle key="n" />],
    ["ranking", "#/ranking", "Ranking", <IconTrophy key="r" />],
  ];
  return (
    <nav className="tabbar" aria-label="Principal">
      {items.map(([k, href, label, icon]) => (
        <a key={k} href={href} aria-current={cur === k || (k === "inicio" && cur === "partida") ? "page" : undefined}>
          <span className="tab-icon">
            {icon}
            {k === "inicio" && live && <span className="live-dot" aria-label="jogo ao vivo" />}
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
      <a href="#/" aria-label="EasyFoot — início" className="topbar-logo">
        <img src="/assets/easyfoot-logo-inline.svg" alt="EasyFoot" height={22} width={156} />
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
