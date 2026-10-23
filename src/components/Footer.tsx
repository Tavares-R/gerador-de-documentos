export function Footer() {
  return (
    <footer
      className="br-footer"
      id="footer"
      style={{
        backgroundColor: "var(--blue-warm-vivid-90, #071d41)",
        color: "#ffffff",
        marginTop: "auto",
        padding: 0,
      }}
    >
      <div className="container-lg py-2">
        <div className="d-flex flex-wrap align-items-center justify-content-between">
          <div className="d-flex align-items-center mr-4">
            <img
              src="https://barra.sistema.gov.br/v1/assets/govbr.webp"
              alt="Gov.br"
              style={{
                height: "28px",
                filter: "brightness(0) invert(1)",
              }}
            />

            <span
              className="br-divider vertical mx-3"
              style={{
                borderColor: "rgba(255, 255, 255, 0.35)",
                minHeight: "32px",
              }}
              aria-hidden="true"
            ></span>

            <div>
              <div className="text-bold text-white" style={{ lineHeight: 1.2 }}>
                CONTÁGIL
              </div>

              <div
                className="text-white"
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.75,
                  lineHeight: 1.2,
                }}
              >
                Gerador de Documentos
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center mt-2 mt-md-0">
            <div
              className="text-white mr-4"
              style={{
                fontSize: "0.8rem",
                opacity: 0.85,
              }}
            >
              Receita Federal do Brasil
            </div>

            <div className="text-white mr-3" style={{ fontSize: "0.8rem" }}>
              Versão 1.0.1
            </div>

            <span
              className="d-inline-block rounded px-2 py-1 text-bold"
              style={{
                backgroundColor: "#ffffff",
                color: "#071d41",
                fontSize: "0.65rem",
                lineHeight: 1,
              }}
            >
              PRODUÇÃO
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
