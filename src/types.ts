export interface DadosProcesso {
  numero: string;
  contribuinte: string;
  cpf_cnpj: string;
  assunto: string;
  situacao: string;
  data_entrada: string;
  localizacao: string;
}

declare global {
  interface Window {
    pegar_usuario_python: () => Promise<string>;
    buscar_processo_python: (numero: string) => Promise<DadosProcesso>;
  }
}
