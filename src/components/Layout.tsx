import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
  titulo?: string;
  usuario?: string;
}

export function Layout({
  children,
  titulo = "Sistema ContÁgil",
  usuario = "...",
}: LayoutProps) {
  return (
    <div
      className="template-base"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <Header
        titulo={titulo}
        subtitulo="Receita Federal do Brasil"
        usuario={usuario}
      />

      <main
        className="d-flex flex-fill"
        id="main"
        style={{
          flex: 1,
        }}
      >
        <div className="container-lg pt-3 w-100">{children}</div>
      </main>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
