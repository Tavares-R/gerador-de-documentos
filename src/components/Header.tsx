interface HeaderProps {
  titulo: string;
  subtitulo: string;
  usuario: string;
}

export function Header({ titulo, subtitulo, usuario }: HeaderProps) {
  return (
    <header
      id="header"
      className="br-header"
      style={{
        padding: 0,
        margin: 0,
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div className="container-lg py-2">
        <div className="d-flex align-items-center justify-content-between">
          {/* Identidade e nome do sistema */}
          <div className="d-flex align-items-center">
            <img
              src="https://barra.sistema.gov.br/v1/assets/govbr.webp"
              alt="Gov.br"
              style={{
                width: "92px",
                height: "auto",
                flexShrink: 0,
              }}
            />

            <span
              className="br-divider vertical mx-3"
              style={{
                minHeight: "38px",
              }}
              aria-hidden="true"
            ></span>

            <div className="d-flex align-items-center">
              <div className="mr-4">
                <div
                  className="text-bold text-primary-default"
                  style={{
                    fontSize: "0.85rem",
                    lineHeight: 1.1,
                  }}
                >
                  CONTÁGIL
                </div>
              </div>

              <div>
                <div
                  className="text-bold"
                  style={{
                    fontSize: "1.05rem",
                    lineHeight: 1.2,
                  }}
                >
                  {titulo}
                </div>

                <div
                  className="text-muted"
                  style={{
                    fontSize: "0.75rem",
                    lineHeight: 1.2,
                  }}
                >
                  {subtitulo}
                </div>
              </div>
            </div>
          </div>

          {/* Usuário autenticado */}
          <div
            className="d-flex align-items-center ml-3"
            aria-label={`Usuário autenticado: ${usuario}`}
            title={`Usuário autenticado: ${usuario}`}
          >
            <i
              className="fas fa-user-circle text-primary-default mr-2"
              aria-hidden="true"
              style={{
                fontSize: "1.25rem",
              }}
            ></i>

            <div className="d-none d-sm-flex flex-column">
              <span
                className="text-muted"
                style={{
                  fontSize: "0.68rem",
                  lineHeight: 1.1,
                }}
              >
                Usuário autenticado
              </span>

              <span
                className="text-bold text-primary-default"
                style={{
                  fontSize: "0.78rem",
                  lineHeight: 1.2,
                  maxWidth: "260px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {usuario}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
