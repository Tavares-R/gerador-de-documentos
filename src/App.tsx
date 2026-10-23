import { useEffect, useMemo, useRef, useState } from "react";
import { BrButton, BrCard } from "@govbr-ds/webcomponents-react";
import { Layout } from "./components/Layout";

type StatusDados =
  | "PRONTO"
  | "SEM_NOTA_PADRONIZADA"
  | "NOTA_INCOMPLETA"
  | "MULTIPLAS_NOTAS"
  | "ERRO_CONSULTA";

interface CaixaEProcesso {
  id: string;
  nome: string;
  eh_comissao: boolean;
}
interface SubcaixaEProcesso {
  id: string;
  nome: string;
  total: number;
}
interface Processo {
  id: string;
  no_do_processo: string;
  numero_normalizado: string;
  interessado: string;
  cnpj_cpf: string;
  responsavel: string;
  meu_processo: boolean;
  sem_responsavel: boolean;
  subcaixa_id: string;
  subcaixa_nome: string;
  status_dados: "NAO_VERIFICADO";
}

interface RespostaCaixasEProcesso {
  sucesso: boolean;
  caixa_padrao_id: string;
  caixas: CaixaEProcesso[];
  erros: string[];
}
interface RespostaProcessosEProcesso {
  sucesso: boolean;
  usuario: string;
  total: number;
  caixa: { id: string; nome: string };
  total_meus: number;
  total_sem_responsavel: number;
  processos: Processo[];
  subcaixas: SubcaixaEProcesso[];
  erros: string[];
}

interface RespostaConsultaProcesso {
  sucesso: boolean;
  status_dados: StatusDados;
  dados: Record<string, unknown>;
  campos_ausentes: string[];
  erro: string;
}

type SituacaoRevisao = "VALIDADO" | "CONFERIR" | "PREENCHER";

interface DadosRevisaveis {
  edital: string;
  processo_do_leilao: string;
  data_do_leilao: string;
  lote: string;
  valor_referencia: string;
  teto_multa: string;
  teto_aplicado: boolean;
  valor_arrematacao: string;
  multa: string;
}

interface ProcessoValidado {
  id: string;
  no_do_processo: string;
  interessado: string;
  cnpj_cpf: string;
  status_dados: StatusDados;
  campos_ausentes: string[];
  erro: string;
  situacao: SituacaoRevisao;
  conferido: boolean;
  alterado_pelo_usuario: boolean;
  dados: DadosRevisaveis;
}

interface ProcessoRevisadoParaGeracao {
  id: string;
  no_do_processo: string;
  numero_normalizado: string;
  interessado: string;
  cnpj_cpf: string;
  edital: string;
  processo_do_leilao: string;
  data_do_leilao: string;
  lote: string;
  valor_referencia: string;
  valor_arrematacao: string;
  multa: string;
  teto_multa: string;
  teto_aplicado: boolean;
  conferido: boolean;
}

interface ProcessoComProblema {
  no_do_processo: string;
  status_dados: StatusDados;
  campos_ausentes?: string[];
  erro?: string;
}

interface RespostaGeracao {
  sucesso: boolean;
  requer_confirmacao: boolean;
  qtd: number;
  processos_gerados: number;
  processos_incompletos: ProcessoComProblema[];
  processos_bloqueados: ProcessoComProblema[];
  pasta: string;
  erros: string[];
}

interface ResultadoGeracao {
  sucesso: boolean;
  qtd: number;
  processosGerados: number;
  processosSolicitados: number;
  erros: string[];
}

declare global {
  interface Window {
    inicializar_sistema: () => Promise<{
      conectado: boolean;
      modelos: string[];
      msg: string;
      erros?: string[];
    }>;
    listar_caixas_eprocesso: () => Promise<RespostaCaixasEProcesso>;
    listar_processos_eprocesso: (
      caixaId: string,
    ) => Promise<RespostaProcessosEProcesso>;
    consultar_dados_processo: (
      numeroProcesso: string,
    ) => Promise<RespostaConsultaProcesso>;
    gerar_documentos_revisados: (
      processos: ProcessoRevisadoParaGeracao[],
      usuario: string,
      modelos: string[],
    ) => Promise<RespostaGeracao>;
    obter_usuario_sistema: () => Promise<{ usuario: string }>;
    fechar_sistema: () => Promise<{ ok: boolean }>;
    abrir_pasta_documentos_gerados: () => Promise<{
      sucesso: boolean;
      pasta?: string;
      mensagem?: string;
      erro?: string;
    }>;
  }
}

const limparNomeModelo = (nome: string) => nome.replace(/\.(docx|odt)$/i, "");
const textoQuantidade = (
  quantidade: number,
  singular: string,
  plural: string,
) => `${quantidade} ${quantidade === 1 ? singular : plural}`;
const valorMonetarioFormatado = (valor: string) => {
  const numero = converterMoedaParaNumero(valor);
  return numero === null ? valor : formatarMoedaBrasileira(numero);
};

const textoDoDado = (
  dados: Record<string, unknown> | undefined,
  chave: string,
) => {
  const valor = dados?.[chave];
  return valor === null || valor === undefined ? "" : String(valor).trim();
};

const criarDadosRevisaveis = (
  dados: Record<string, unknown> | undefined,
): DadosRevisaveis => ({
  edital: textoDoDado(dados, "edital"),
  processo_do_leilao: textoDoDado(dados, "processo_do_leilao"),
  data_do_leilao: textoDoDado(dados, "data_do_leilao"),
  lote: textoDoDado(dados, "lote"),
  valor_referencia:
    textoDoDado(dados, "valor_referencia") ||
    textoDoDado(dados, "valor_minimo"),
  teto_multa: textoDoDado(dados, "teto_multa"),
  teto_aplicado: textoDoDado(dados, "teto_aplicado").toLowerCase() === "true",
  valor_arrematacao: textoDoDado(dados, "valor_arrematacao"),
  multa: textoDoDado(dados, "multa"),
});

const identificarSituacaoRevisao = (
  status: StatusDados,
  camposAusentes: string[],
): SituacaoRevisao => {
  if (status === "PRONTO" && camposAusentes.length === 0) return "VALIDADO";
  if (status === "SEM_NOTA_PADRONIZADA" || status === "NOTA_INCOMPLETA") {
    return "PREENCHER";
  }
  return "CONFERIR";
};

const converterMoedaParaNumero = (valor: string) => {
  const texto = valor
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

const formatarMoedaBrasileira = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ResultadoCalculoMulta {
  multa: string;
  teto: string;
  tetoAplicado: boolean;
}

const calcularMulta = (
  valorReferencia: string,
  valorArrematacao: string,
): ResultadoCalculoMulta => {
  const referencia = converterMoedaParaNumero(valorReferencia);
  const arrematacao = converterMoedaParaNumero(valorArrematacao);

  if (referencia === null || arrematacao === null) {
    return { multa: "", teto: "", tetoAplicado: false };
  }

  const multaSemTeto = referencia * 0.2;
  const teto = arrematacao * 0.3;
  const multaFinal = Math.min(multaSemTeto, teto);

  return {
    multa: formatarMoedaBrasileira(multaFinal),
    teto: formatarMoedaBrasileira(teto),
    tetoAplicado: multaSemTeto > teto,
  };
};

function useGeradorSetorial() {
  const [usuarioNome, setUsuarioNome] = useState("...");
  const [listaModelosDisponiveis, setListaModelosDisponiveis] = useState<
    string[]
  >([]);
  const [modelosSelecionados, setModelosSelecionados] = useState<string[]>([]);
  const [caixas, setCaixas] = useState<CaixaEProcesso[]>([]);
  const [caixaSelecionadaId, setCaixaSelecionadaId] = useState("");
  const [subcaixas, setSubcaixas] = useState<SubcaixaEProcesso[]>([]);
  const [dados, setDados] = useState<Processo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [mostrarSomenteMeus, setMostrarSomenteMeus] = useState(true);
  const [incluirSemResponsavel, setIncluirSemResponsavel] = useState(false);
  const [totalProcessos, setTotalProcessos] = useState(0);
  const [totalMeusProcessos, setTotalMeusProcessos] = useState(0);
  const [totalSemResponsavel, setTotalSemResponsavel] = useState(0);
  const [statusGlobal, setStatusGlobal] = useState(
    "Conectando ao e-Processo...",
  );
  const [isProcessando, setIsProcessando] = useState(false);
  const [isGerando, setIsGerando] = useState(false);
  const [processosValidados, setProcessosValidados] = useState<
    ProcessoValidado[]
  >([]);
  const [mostrarResultadoValidacao, setMostrarResultadoValidacao] =
    useState(false);
  const [resultadoGeracao, setResultadoGeracao] =
    useState<ResultadoGeracao | null>(null);

  const carregarProcessosCaixa = async (caixaId: string) => {
    setIsProcessando(true);
    setStatusGlobal("Carregando processos da caixa selecionada...");
    setSelecionados([]);
    setDados([]);
    setSubcaixas([]);
    setMostrarResultadoValidacao(false);
    setProcessosValidados([]);
    setResultadoGeracao(null);
    try {
      const resposta = await window.listar_processos_eprocesso(caixaId);
      if (!resposta?.sucesso) {
        setStatusGlobal(
          resposta?.erros?.join("\n") ||
            "Não foi possível carregar os processos da caixa.",
        );
        return;
      }
      if (resposta.usuario) setUsuarioNome(resposta.usuario);
      setCaixaSelecionadaId(resposta.caixa?.id || caixaId);
      setDados(resposta.processos || []);
      setSubcaixas(resposta.subcaixas || []);
      setTotalProcessos(resposta.total || 0);
      setTotalMeusProcessos(resposta.total_meus || 0);
      setTotalSemResponsavel(resposta.total_sem_responsavel || 0);
      setMostrarSomenteMeus((resposta.total_meus || 0) > 0);
      setIncluirSemResponsavel(false);
      setStatusGlobal(
        `${resposta.total || 0} processos carregados de ${resposta.caixa?.nome || "e-Processo"}.`,
      );
    } catch (erro) {
      console.error(erro);
      setStatusGlobal("Não foi possível carregar os processos da caixa.");
    } finally {
      setIsProcessando(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    const iniciar = async () => {
      setIsProcessando(true);
      setStatusGlobal("Preparando o Gerador...");
      try {
        const respostaUsuario = await window.obter_usuario_sistema();
        if (!ativo) return;
        if (respostaUsuario?.usuario) setUsuarioNome(respostaUsuario.usuario);

        const inicializacao = await window.inicializar_sistema();
        if (!ativo) return;
        const modelos = [...(inicializacao?.modelos || [])].sort((a, b) =>
          a.localeCompare(b, "pt-BR", { numeric: true }),
        );
        setListaModelosDisponiveis(modelos);

        setStatusGlobal("Localizando as caixas do e-Processo...");
        const respostaCaixas = await window.listar_caixas_eprocesso();
        if (!ativo) return;
        if (!respostaCaixas?.sucesso) {
          setStatusGlobal(
            respostaCaixas?.erros?.join("\n") ||
              "Não foi possível carregar as caixas do e-Processo.",
          );
          return;
        }
        setCaixas(respostaCaixas.caixas || []);
        const caixaInicial =
          respostaCaixas.caixa_padrao_id ||
          respostaCaixas.caixas?.[0]?.id ||
          "";
        if (caixaInicial) {
          setIsProcessando(false);
          await carregarProcessosCaixa(caixaInicial);
        } else {
          setStatusGlobal("Selecione uma caixa do e-Processo.");
        }
      } catch (erro) {
        console.error(erro);
        if (ativo) setStatusGlobal("Não foi possível iniciar o Gerador.");
      } finally {
        if (ativo) setIsProcessando(false);
      }
    };
    iniciar();
    return () => {
      ativo = false;
    };
  }, []);

  const dadosFiltrados = useMemo(() => {
    if (!mostrarSomenteMeus) return dados;
    return dados.filter(
      (processo) =>
        processo.meu_processo ||
        (incluirSemResponsavel && processo.sem_responsavel),
    );
  }, [dados, mostrarSomenteMeus, incluirSemResponsavel]);
  const gruposSubcaixas = useMemo(
    () =>
      subcaixas
        .map((subcaixa) => ({
          ...subcaixa,
          processos: dadosFiltrados.filter(
            (processo) => processo.subcaixa_id === subcaixa.id,
          ),
        }))
        .filter((grupo) => grupo.processos.length > 0),
    [subcaixas, dadosFiltrados],
  );
  const limparResultados = () => {
    setMostrarResultadoValidacao(false);
    setProcessosValidados([]);
    setResultadoGeracao(null);
  };

  const toggleProcesso = (id: string) => {
    limparResultados();
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  };

  const toggleGrupoProcessos = (ids: string[]) => {
    limparResultados();
    const todosSelecionados =
      ids.length > 0 && ids.every((id) => selecionados.includes(id));
    setSelecionados((atual) =>
      todosSelecionados
        ? atual.filter((id) => !ids.includes(id))
        : Array.from(new Set([...atual, ...ids])),
    );
  };
  const toggleModelo = (modelo: string) => {
    limparResultados();
    setModelosSelecionados((atual) =>
      atual.includes(modelo)
        ? atual.filter((m) => m !== modelo)
        : [...atual, modelo],
    );
  };

  const acaoGerarDocumentos = async () => {
    if (!selecionados.length || !modelosSelecionados.length) return;

    setIsProcessando(true);
    setMostrarResultadoValidacao(false);
    setProcessosValidados([]);
    setResultadoGeracao(null);
    const resultados: ProcessoValidado[] = [];

    try {
      for (let i = 0; i < selecionados.length; i += 1) {
        const id = selecionados[i];
        const processo = dados.find((p) => p.id === id);
        const numero = processo?.no_do_processo || id;
        setStatusGlobal(
          `Verificando processo ${i + 1} de ${selecionados.length}: ${numero}`,
        );

        try {
          const resposta = await window.consultar_dados_processo(id);
          const camposAusentes = resposta.campos_ausentes || [];
          resultados.push({
            id,
            no_do_processo: numero,
            interessado: processo?.interessado || "",
            cnpj_cpf: processo?.cnpj_cpf || "",
            status_dados: resposta.status_dados,
            campos_ausentes: camposAusentes,
            erro: resposta.erro || "",
            situacao: identificarSituacaoRevisao(
              resposta.status_dados,
              camposAusentes,
            ),
            conferido: false,
            alterado_pelo_usuario: false,
            dados: criarDadosRevisaveis(resposta.dados),
          });
        } catch (erro) {
          resultados.push({
            id,
            no_do_processo: numero,
            interessado: processo?.interessado || "",
            cnpj_cpf: processo?.cnpj_cpf || "",
            status_dados: "ERRO_CONSULTA",
            campos_ausentes: [],
            erro:
              erro instanceof Error
                ? erro.message
                : "Não foi possível consultar o processo.",
            situacao: "PREENCHER",
            conferido: false,
            alterado_pelo_usuario: false,
            dados: criarDadosRevisaveis(undefined),
          });
        }
      }

      setProcessosValidados(resultados);
      setMostrarResultadoValidacao(true);
      const prontos = resultados.filter(
        (p) => p.status_dados === "PRONTO",
      ).length;
      setStatusGlobal(
        `Validação concluída. ${textoQuantidade(prontos, "processo pronto", "processos prontos")} de ${resultados.length}.`,
      );
    } finally {
      setIsProcessando(false);
    }
  };

  const atualizarDadoRevisado = (
    processoId: string,
    campo: Exclude<keyof DadosRevisaveis, "teto_aplicado">,
    valor: string,
  ) => {
    setProcessosValidados((atuais) =>
      atuais.map((processo) => {
        if (processo.id !== processoId) return processo;
        const novosDados: DadosRevisaveis = {
          ...processo.dados,
          [campo]: valor,
        };
        if (campo === "valor_referencia" || campo === "valor_arrematacao") {
          const calculo = calcularMulta(
            novosDados.valor_referencia,
            novosDados.valor_arrematacao,
          );
          novosDados.multa = calculo.multa;
          novosDados.teto_multa = calculo.teto;
          novosDados.teto_aplicado = calculo.tetoAplicado;
        }
        return {
          ...processo,
          dados: novosDados,
          conferido: false,
          alterado_pelo_usuario: true,
          situacao: "CONFERIR",
        };
      }),
    );
  };

  const alternarConferenciaProcesso = (processoId: string) => {
    setProcessosValidados((atuais) =>
      atuais.map((processo) =>
        processo.id === processoId
          ? { ...processo, conferido: !processo.conferido }
          : processo,
      ),
    );
  };

  const confirmarTodosValidados = () => {
    setProcessosValidados((atuais) =>
      atuais.map((processo) =>
        processo.situacao === "VALIDADO"
          ? { ...processo, conferido: true }
          : processo,
      ),
    );
  };

  const executarGeracao = async () => {
    const processosRevisados: ProcessoRevisadoParaGeracao[] =
      processosValidados.map((processo) => ({
        id: processo.id,
        no_do_processo: processo.no_do_processo,
        numero_normalizado: processo.id,
        interessado: processo.interessado,
        cnpj_cpf: processo.cnpj_cpf,
        edital: processo.dados.edital,
        processo_do_leilao: processo.dados.processo_do_leilao,
        data_do_leilao: processo.dados.data_do_leilao,
        lote: processo.dados.lote,
        valor_referencia: processo.dados.valor_referencia,
        valor_arrematacao: processo.dados.valor_arrematacao,
        multa: processo.dados.multa,
        teto_multa: processo.dados.teto_multa,
        teto_aplicado: processo.dados.teto_aplicado,
        conferido: processo.conferido,
      }));

    if (
      !processosRevisados.length ||
      processosRevisados.some((processo) => !processo.conferido)
    ) {
      setStatusGlobal("Confirme todos os processos antes da emissão.");
      return;
    }

    setIsProcessando(true);
    setIsGerando(true);
    setResultadoGeracao(null);
    setStatusGlobal("Emitindo documentos com os dados revisados...");

    try {
      const resposta = await window.gerar_documentos_revisados(
        processosRevisados,
        usuarioNome,
        modelosSelecionados,
      );

      setResultadoGeracao({
        sucesso: resposta.sucesso,
        qtd: resposta.qtd || 0,
        processosGerados: resposta.processos_gerados || 0,
        processosSolicitados: processosValidados.length,
        erros: resposta.erros || [],
      });

      if (
        resposta.sucesso &&
        (resposta.erros || []).length === 0 &&
        (resposta.processos_gerados || 0) === processosValidados.length
      ) {
        setMostrarResultadoValidacao(false);
        setSelecionados([]);
        setStatusGlobal(
          `${textoQuantidade(resposta.qtd || 0, "documento gerado", "documentos gerados")} com os dados revisados.`,
        );
      } else if (resposta.sucesso) {
        setMostrarResultadoValidacao(true);
        setStatusGlobal(
          "Parte dos documentos foi gerada. Verifique os detalhes para corrigir os demais processos.",
        );
      } else {
        setStatusGlobal("Não foi possível concluir a emissão.");
      }
    } catch (erro) {
      setResultadoGeracao({
        sucesso: false,
        qtd: 0,
        processosGerados: 0,
        processosSolicitados: processosValidados.length,
        erros: [
          erro instanceof Error
            ? erro.message
            : "Erro inesperado durante a geração.",
        ],
      });
      setStatusGlobal("Ocorreu um erro durante a geração.");
    } finally {
      setIsGerando(false);
      setIsProcessando(false);
    }
  };
  const iniciarNovaEmissao = () => {
    setSelecionados([]);
    setProcessosValidados([]);
    setMostrarResultadoValidacao(false);
    setResultadoGeracao(null);
    setStatusGlobal(
      `${totalProcessos} processos carregados. Selecione os processos da nova emissão.`,
    );
  };
  const alterarCaixa = async (caixaId: string) => {
    if (!caixaId || caixaId === caixaSelecionadaId) return;
    await carregarProcessosCaixa(caixaId);
  };
  const abrirPasta = async () => {
    try {
      const resposta = await window.abrir_pasta_documentos_gerados();
      setStatusGlobal(
        resposta.sucesso
          ? resposta.mensagem || "A pasta de documentos foi aberta."
          : resposta.erro || "Não foi possível abrir a pasta dos documentos.",
      );
    } catch {
      setStatusGlobal("Não foi possível abrir a pasta dos documentos.");
    }
  };

  const sair = async () => {
    try {
      await window.fechar_sistema();
    } catch {
      window.close();
    }
  };

  return {
    estado: {
      usuarioNome,
      caixas,
      caixaSelecionadaId,
      subcaixas,
      gruposSubcaixas,
      listaModelosDisponiveis,
      modelosSelecionados,
      dadosFiltrados,
      selecionados,
      mostrarSomenteMeus,
      incluirSemResponsavel,
      totalProcessos,
      totalMeusProcessos,
      totalSemResponsavel,
      statusGlobal,
      isProcessando,
      isGerando,
      processosValidados,
      mostrarResultadoValidacao,
      resultadoGeracao,
    },
    acoes: {
      acaoGerarDocumentos,
      executarGeracao,
      atualizarDadoRevisado,
      alternarConferenciaProcesso,
      confirmarTodosValidados,
      toggleProcesso,
      toggleGrupoProcessos,
      toggleModelo,
      setMostrarSomenteMeus,
      setIncluirSemResponsavel,
      alterarCaixa,
      fecharValidacao: () => setMostrarResultadoValidacao(false),
      fecharGeracao: () => setResultadoGeracao(null),
      iniciarNovaEmissao,
      abrirPasta,
      sair,
    },
  };
}

interface PainelValidacaoProps {
  processos: ProcessoValidado[];
  onFechar: () => void;
  onAtualizarDado: (
    processoId: string,
    campo: Exclude<keyof DadosRevisaveis, "teto_aplicado">,
    valor: string,
  ) => void;
  onAlternarConferencia: (processoId: string) => void;
  onConfirmarValidados: () => void;
  onEmitir: () => void;
  documentosPrevistos: number;
  isGerando: boolean;
}

function PainelValidacao({
  processos,
  onFechar,
  onAtualizarDado,
  onAlternarConferencia,
  onConfirmarValidados,
  onEmitir,
  documentosPrevistos,
  isGerando,
}: PainelValidacaoProps) {
  const processoCompleto = (processo: ProcessoValidado) =>
    Boolean(
      processo.dados.edital.trim() &&
      processo.dados.processo_do_leilao.trim() &&
      processo.dados.data_do_leilao.trim() &&
      processo.dados.lote.trim() &&
      converterMoedaParaNumero(processo.dados.valor_referencia) !== null &&
      converterMoedaParaNumero(processo.dados.valor_arrematacao) !== null &&
      processo.dados.multa.trim(),
    );

  const totalCompletos = processos.filter(processoCompleto).length;
  const totalConferidos = processos.filter(
    (processo) => processo.conferido,
  ).length;
  const totalPendentes = processos.length - totalCompletos;
  const todosConferidos =
    processos.length > 0 &&
    totalPendentes === 0 &&
    processos.every((processo) => processo.conferido);

  const campoEditavel = (
    processo: ProcessoValidado,
    campo: Exclude<keyof DadosRevisaveis, "teto_aplicado">,
    rotulo: string,
    monetario = false,
  ) => {
    const valor = processo.dados[campo];
    const valorExibido = monetario ? valor.replace(/^R\$\s*/i, "") : valor;
    const estiloInput = {
      width: "100%",
      height: 40,
      minWidth: 0,
      boxSizing: "border-box" as const,
    };

    const input = (
      <input
        id={`${processo.id}-${campo}`}
        type="text"
        className="form-control"
        style={estiloInput}
        value={valorExibido}
        aria-label={`${rotulo} do processo ${processo.no_do_processo}`}
        onChange={(e) => onAtualizarDado(processo.id, campo, e.target.value)}
        onBlur={(e) => {
          if (!monetario) return;
          const numero = converterMoedaParaNumero(e.target.value);
          if (numero !== null) {
            onAtualizarDado(
              processo.id,
              campo,
              formatarMoedaBrasileira(numero),
            );
          }
        }}
        disabled={isGerando}
      />
    );

    return (
      <div style={{ width: "100%", minWidth: 0 }}>
        <label
          className="small font-weight-bold"
          htmlFor={`${processo.id}-${campo}`}
          style={{ display: "block", marginBottom: 6, lineHeight: "20px" }}
        >
          {rotulo}
        </label>
        {monetario ? (
          <div
            style={{ display: "flex", width: "100%", alignItems: "stretch" }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                minWidth: 48,
                height: 40,
                boxSizing: "border-box",
                border: "1px solid #888",
                borderRight: 0,
                borderRadius: "4px 0 0 4px",
                backgroundColor: "#f0f0f0",
                color: "#333",
                fontWeight: 600,
              }}
            >
              R$
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>{input}</div>
          </div>
        ) : (
          input
        )}
      </div>
    );
  };

  return (
    <div className="mt-4">
      <BrCard>
        <div className="p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
            <div className="mb-2 mb-md-0">
              <h4 className="text-bold text-primary-default m-0">
                4. Confira os dados antes da emissão
              </h4>
              <div className="small text-muted mt-1">
                Complete os dados necessários e confirme cada processo antes de
                emitir.
              </div>
            </div>
            <BrButton
              type="button"
              emphasis="tertiary"
              density="small"
              onClick={onConfirmarValidados}
              disabled={isGerando || totalCompletos === 0}
            >
              Confirmar processos completos
            </BrButton>
          </div>

          <div className="row mb-3">
            {[
              ["Processos", processos.length, "text-primary-default"],
              ["Completos", totalCompletos, "text-success"],
              ["Conferidos", totalConferidos, "text-success"],
              [
                "Com pendências",
                totalPendentes,
                totalPendentes ? "text-danger" : "text-success",
              ],
            ].map(([rotulo, valor, classe]) => (
              <div className="col-6 col-md-3 mb-2" key={String(rotulo)}>
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">{rotulo}</div>
                  <div className={`text-bold text-up-02 ${classe}`}>
                    {valor}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-light rounded p-3">
            {processos.map((processo, indice) => {
              const completo = processoCompleto(processo);
              const status = processo.conferido
                ? "Conferido"
                : completo
                  ? "Pronto para conferir"
                  : "Preencha os campos";
              const statusIcone = processo.conferido
                ? "fa-check-circle"
                : completo
                  ? "fa-clipboard-check"
                  : "fa-edit";
              const statusClasse = processo.conferido
                ? "border-success text-success"
                : completo
                  ? "border-primary text-primary-default"
                  : "border-danger text-danger";

              return (
                <div
                  className={indice < processos.length - 1 ? "mb-5" : "mb-0"}
                  key={processo.id}
                >
                  <div
                    className="bg-white rounded"
                    style={{
                      border: "1px solid #b8c2cc",
                      borderLeft: processo.conferido
                        ? "7px solid #168821"
                        : completo
                          ? "7px solid #1351b4"
                          : "7px solid #e52207",
                      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className={`px-4 py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center ${
                        processo.conferido
                          ? "bg-success-pastel-01"
                          : completo
                            ? "bg-primary-pastel-01"
                            : "bg-danger-pastel-01"
                      }`}
                    >
                      <div>
                        <div className="small text-muted">
                          Processo {indice + 1} de {processos.length}
                        </div>
                        <div className="text-bold text-primary-default text-up-01">
                          {processo.no_do_processo}
                        </div>
                        <div className="small text-muted">
                          {processo.interessado || "Interessado não informado"}
                        </div>
                      </div>
                      <div className="mt-2 mt-md-0 text-md-right">
                        <div
                          className={`d-inline-flex align-items-center border rounded px-3 py-2 small font-weight-bold bg-white ${statusClasse}`}
                        >
                          <i
                            className={`fas ${statusIcone} mr-2`}
                            aria-hidden="true"
                          ></i>
                          {status}
                        </div>
                        {processo.alterado_pelo_usuario && (
                          <div className="small text-primary-default mt-1">
                            Informações alteradas nesta revisão
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="text-bold text-primary-default mb-2">
                        Dados do edital
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                          gap: 24,
                          marginBottom: 24,
                        }}
                      >
                        <div style={{ flex: "4 1 240px", minWidth: 220 }}>
                          {campoEditavel(processo, "edital", "Edital")}
                        </div>
                        <div style={{ flex: "5 1 300px", minWidth: 260 }}>
                          {campoEditavel(
                            processo,
                            "processo_do_leilao",
                            "Processo de licitação",
                          )}
                        </div>
                        <div style={{ flex: "3 1 200px", minWidth: 180 }}>
                          {campoEditavel(
                            processo,
                            "data_do_leilao",
                            "Data do leilão",
                          )}
                        </div>
                      </div>

                      <div className="text-bold text-primary-default mt-2 mb-2">
                        Dados da penalidade
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                          gap: 24,
                          marginBottom: 20,
                        }}
                      >
                        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                          {campoEditavel(processo, "lote", "Lotes")}
                        </div>
                        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                          {campoEditavel(
                            processo,
                            "valor_referencia",
                            "Valor de referência",
                            true,
                          )}
                        </div>
                        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                          {campoEditavel(
                            processo,
                            "valor_arrematacao",
                            "Valor de arrematação",
                            true,
                          )}
                        </div>
                      </div>

                      <div
                        className="border rounded bg-light p-3"
                        style={{ marginTop: 0 }}
                      >
                        <div className="row align-items-center">
                          <div className="col-md-4 mb-2 mb-md-0">
                            <div className="small text-muted">
                              Multa calculada
                            </div>
                            <div className="text-bold text-up-02 text-primary-default">
                              {processo.dados.multa || "Aguardando valores"}
                            </div>
                          </div>
                          <div className="col-md-8">
                            {processo.dados.multa &&
                              (processo.dados.teto_aplicado ? (
                                <div className="border rounded bg-warning-pastel-01 p-2 text-dark">
                                  <i
                                    className="fas fa-exclamation-triangle mr-2"
                                    aria-hidden="true"
                                  ></i>
                                  <strong>Teto de 30% aplicado.</strong> A multa
                                  foi limitada a{" "}
                                  {valorMonetarioFormatado(
                                    processo.dados.teto_multa,
                                  )}
                                  , correspondente a 30% do valor de arrematação
                                  de{" "}
                                  {valorMonetarioFormatado(
                                    processo.dados.valor_arrematacao,
                                  )}
                                  .
                                </div>
                              ) : (
                                <div className="small text-muted">
                                  20% do valor de referência.
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`px-4 py-3 border-top d-flex justify-content-end ${processo.conferido ? "bg-success-pastel-01" : "bg-light"}`}
                    >
                      {completo ? (
                        <label
                          className="d-flex align-items-center mb-0"
                          style={{
                            cursor: isGerando ? "not-allowed" : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={processo.conferido}
                            onChange={() => onAlternarConferencia(processo.id)}
                            disabled={isGerando}
                          />
                          <span className="font-weight-bold">
                            {processo.conferido
                              ? "Dados conferidos"
                              : "Conferi os dados deste processo"}
                          </span>
                        </label>
                      ) : (
                        <div className="d-flex align-items-center text-muted">
                          <i
                            className="fas fa-info-circle mr-2"
                            aria-hidden="true"
                          ></i>
                          <span>
                            Preencha todos os campos para liberar a confirmação.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center mt-4 border-top pt-3">
            <div className="mb-2 mb-md-0">
              <div
                className={
                  totalPendentes
                    ? "text-bold text-danger"
                    : "text-bold text-primary-default"
                }
              >
                {totalPendentes
                  ? `${textoQuantidade(totalPendentes, "processo com pendência", "processos com pendências")}`
                  : `${textoQuantidade(totalConferidos, "processo conferido", "processos conferidos")} de ${processos.length}`}
              </div>
              <div className="small text-muted">
                Alterar qualquer campo desmarca automaticamente a confirmação.
              </div>
            </div>
            <div className="d-flex">
              <BrButton
                type="button"
                emphasis="secondary"
                className="mr-2"
                onClick={onFechar}
                disabled={isGerando}
              >
                Alterar seleção
              </BrButton>
              <BrButton
                type="button"
                emphasis="primary"
                onClick={onEmitir}
                disabled={!todosConferidos || isGerando}
                title={
                  todosConferidos
                    ? "Emitir os documentos"
                    : "Confirme todos os processos antes da emissão"
                }
              >
                <i className="fas fa-print mr-2" aria-hidden="true"></i>
                {todosConferidos
                  ? `Emitir ${textoQuantidade(documentosPrevistos, "documento", "documentos")}`
                  : totalPendentes
                    ? "Complete os campos pendentes"
                    : "Confira todos os processos"}
              </BrButton>
            </div>
          </div>
        </div>
      </BrCard>
    </div>
  );
}

interface PainelGeracaoProps {
  resultado: ResultadoGeracao;
  onNovaEmissao: () => void;
  onVoltarParaCorrecao: () => void;
  onAbrirPasta: () => void;
}
function PainelGeracao({
  resultado,
  onNovaEmissao,
  onVoltarParaCorrecao,
  onAbrirPasta,
}: PainelGeracaoProps) {
  const parcial =
    resultado.processosGerados > 0 &&
    (resultado.processosGerados < resultado.processosSolicitados ||
      resultado.erros.length > 0);
  const sucessoTotal =
    resultado.sucesso && !parcial && resultado.erros.length === 0;
  const falhaTotal = resultado.processosGerados === 0;
  const titulo = sucessoTotal
    ? "Documentos gerados"
    : parcial
      ? "Emissão concluída com pendências"
      : "Não foi possível gerar os documentos";
  const classe = sucessoTotal
    ? "text-success"
    : parcial
      ? "text-dark"
      : "text-danger";
  const icone = sucessoTotal
    ? "fa-check-circle"
    : parcial
      ? "fa-exclamation-triangle"
      : "fa-times-circle";

  return (
    <div className="mt-4">
      <BrCard>
        <div className="p-4">
          <h4 className={`text-bold ${classe}`}>
            <i className={`fas ${icone} mr-2`} aria-hidden="true"></i>
            {titulo}
          </h4>

          {sucessoTotal ? (
            <div className="border rounded bg-success-pastel-01 px-3 py-2 my-3">
              {textoQuantidade(
                resultado.qtd,
                "documento gerado",
                "documentos gerados",
              )}{" "}
              para{" "}
              {textoQuantidade(
                resultado.processosGerados,
                "processo",
                "processos",
              )}
              .
            </div>
          ) : (
            <div className="row my-3">
              <div className="col-6 col-md-3 mb-2">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">Documentos gerados</div>
                  <div className="text-bold text-up-02 text-primary-default">
                    {resultado.qtd}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3 mb-2">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">Processos gerados</div>
                  <div className="text-bold text-up-02 text-success">
                    {resultado.processosGerados}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3 mb-2">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">Processos solicitados</div>
                  <div className="text-bold text-up-02 text-primary-default">
                    {resultado.processosSolicitados}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3 mb-2">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">Com pendência</div>
                  <div
                    className={`text-bold text-up-02 ${resultado.erros.length ? "text-danger" : "text-success"}`}
                  >
                    {Math.max(
                      resultado.processosSolicitados -
                        resultado.processosGerados,
                      0,
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {parcial && (
            <div className="border rounded bg-warning-pastel-01 text-dark p-3 mb-3">
              Parte dos documentos foi gerada. Confira abaixo os processos que
              precisam de atenção.
            </div>
          )}
          {falhaTotal && (
            <div className="border rounded bg-danger-pastel-01 p-3 mb-3">
              Nenhum documento foi gerado. Corrija as informações indicadas e
              tente novamente.
            </div>
          )}

          {!!resultado.erros.length && (
            <div className="border rounded p-3 mb-3">
              <div className="font-weight-bold mb-2">Detalhes</div>
              <ul className="mb-0 pl-4">
                {resultado.erros.map((erro, i) => (
                  <li key={`${i}-${erro}`}>{erro}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="d-flex flex-wrap justify-content-end">
            {!sucessoTotal && (
              <BrButton
                type="button"
                emphasis="secondary"
                className="mr-2 mb-2"
                onClick={onVoltarParaCorrecao}
              >
                Voltar para corrigir
              </BrButton>
            )}
            {sucessoTotal && (
              <BrButton
                type="button"
                emphasis="secondary"
                className="mr-2 mb-2"
                onClick={onNovaEmissao}
              >
                Nova emissão
              </BrButton>
            )}
            {resultado.processosGerados > 0 && (
              <BrButton
                type="button"
                emphasis="primary"
                className="mb-2"
                onClick={onAbrirPasta}
              >
                <i className="fas fa-folder-open mr-2" aria-hidden="true"></i>
                Abrir pasta
              </BrButton>
            )}
          </div>
        </div>
      </BrCard>
    </div>
  );
}

export default function App() {
  const { estado, acoes } = useGeradorSetorial();
  const bloqueada = estado.isProcessando;
  const revisaoAberta = estado.mostrarResultadoValidacao;
  const resultadoAberto = Boolean(estado.resultadoGeracao);
  const selecaoRecolhida = revisaoAberta || resultadoAberto;
  const revisaoRef = useRef<HTMLDivElement | null>(null);
  const resultadoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!revisaoAberta) return;
    window.setTimeout(() => {
      revisaoRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, [revisaoAberta]);

  useEffect(() => {
    if (!resultadoAberto) return;
    window.setTimeout(() => {
      resultadoRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, [resultadoAberto]);

  const totalPrevisto =
    estado.selecionados.length * estado.modelosSelecionados.length;
  const pronto =
    estado.selecionados.length > 0 &&
    estado.modelosSelecionados.length > 0 &&
    !bloqueada;
  const meio = Math.ceil(estado.listaModelosDisponiveis.length / 2);
  const colunas = [
    estado.listaModelosDisponiveis.slice(0, meio),
    estado.listaModelosDisponiveis.slice(meio),
  ];
  const caixaSelecionada = estado.caixas.find(
    (caixa) => caixa.id === estado.caixaSelecionadaId,
  );
  const totalProcessosDoResumo =
    estado.processosValidados.length || estado.selecionados.length;

  return (
    <Layout titulo="Gerador de Documentos" usuario={estado.usuarioNome}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-bold m-0 text-primary-default text-up-02">
          <i className="fas fa-file-contract mr-2" aria-hidden="true"></i>
          Emissão de Documentos
        </h2>
        <BrButton
          type="button"
          emphasis="secondary"
          density="small"
          onClick={acoes.sair}
        >
          Sair
        </BrButton>
      </div>

      {selecaoRecolhida ? (
        <BrCard>
          <div className="p-3 d-flex flex-wrap justify-content-between align-items-center">
            <div className="d-flex flex-wrap align-items-center">
              <div className="mr-5 mb-2 mb-md-0">
                <div className="small text-muted">Caixa do e-Processo</div>
                <div className="font-weight-bold text-primary-default">
                  <i
                    className="fas fa-check-circle text-success mr-2"
                    aria-hidden="true"
                  ></i>
                  {caixaSelecionada?.nome || "Caixa selecionada"}
                </div>
              </div>
              <div className="mr-5 mb-2 mb-md-0">
                <div className="small text-muted">Seleção</div>
                <div className="font-weight-bold">
                  {textoQuantidade(
                    totalProcessosDoResumo,
                    "processo",
                    "processos",
                  )}{" "}
                  e{" "}
                  {textoQuantidade(
                    estado.modelosSelecionados.length,
                    "modelo",
                    "modelos",
                  )}
                </div>
              </div>
              <div className="mb-2 mb-md-0">
                <div className="small text-muted">Documentos previstos</div>
                <div className="font-weight-bold">
                  {totalProcessosDoResumo * estado.modelosSelecionados.length}
                </div>
              </div>
            </div>
            {!estado.isGerando && !resultadoAberto && (
              <BrButton
                type="button"
                emphasis="secondary"
                density="small"
                onClick={acoes.fecharValidacao}
              >
                Alterar seleção
              </BrButton>
            )}
          </div>
        </BrCard>
      ) : (
        <>
          <BrCard>
            <div className="p-4">
              <div className="text-bold text-primary-default mb-2">
                1. Caixa do e-Processo
              </div>
              <div className="mb-3" style={{ maxWidth: 720 }}>
                <label
                  className="small text-muted mb-1"
                  htmlFor="caixa-eprocesso"
                >
                  Caixa principal
                </label>
                <select
                  id="caixa-eprocesso"
                  className="form-control"
                  value={estado.caixaSelecionadaId}
                  onChange={(e) => acoes.alterarCaixa(e.target.value)}
                  disabled={bloqueada}
                >
                  {estado.caixas.map((caixa) => (
                    <option key={caixa.id} value={caixa.id}>
                      {caixa.nome}
                      {caixa.eh_comissao ? " (comissão)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="d-flex align-items-center border rounded px-3 py-3 bg-light">
                <i
                  className={`fas ${estado.totalProcessos > 0 ? "fa-check-circle text-success" : "fa-circle-notch fa-spin text-primary-default"} mr-3`}
                  aria-hidden="true"
                ></i>
                <div>
                  <div>
                    <strong className="mr-3">e-Processo</strong>
                    {estado.statusGlobal}
                  </div>
                  <div className="small text-muted">
                    {estado.totalMeusProcessos} atribuídos a você, de{" "}
                    {estado.totalProcessos} processos encontrados
                  </div>
                </div>
              </div>

              <div className="text-bold text-primary-default mt-4 mb-3">
                2. Selecione os modelos
              </div>
              <div
                className="p-2 border rounded bg-light"
                style={{ maxHeight: 220, overflowY: "auto" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "4px 16px",
                  }}
                >
                  {colunas.map((coluna, ci) => (
                    <div key={ci}>
                      {coluna.map((modelo) => {
                        const marcado =
                          estado.modelosSelecionados.includes(modelo);
                        return (
                          <label
                            key={modelo}
                            className={`d-flex align-items-center m-0 mb-1 p-2 rounded ${marcado ? "bg-primary-pastel-01" : "bg-white"}`}
                          >
                            <input
                              type="checkbox"
                              className="mr-3"
                              checked={marcado}
                              onChange={() => acoes.toggleModelo(modelo)}
                              disabled={bloqueada}
                            />
                            <i
                              className={`fas ${modelo.toLowerCase().endsWith(".docx") ? "fa-file-word text-primary-default" : "fa-file-alt"} mr-3`}
                              aria-hidden="true"
                            ></i>
                            <span>{limparNomeModelo(modelo)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-right small mt-2 text-primary-default font-weight-bold">
                {textoQuantidade(
                  estado.modelosSelecionados.length,
                  "modelo selecionado",
                  "modelos selecionados",
                )}
              </div>
            </div>
          </BrCard>

          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-end mb-3">
              <div>
                <h4 className="text-bold text-primary-default m-0">
                  3. Selecione os processos ({estado.dadosFiltrados.length})
                </h4>
                <div className="small text-muted mt-1">
                  <label className="mr-4 mb-1">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={estado.mostrarSomenteMeus}
                      onChange={(e) =>
                        acoes.setMostrarSomenteMeus(e.target.checked)
                      }
                      disabled={bloqueada || estado.totalMeusProcessos === 0}
                    />
                    {estado.totalMeusProcessos > 0
                      ? `Mostrar apenas meus processos (${estado.usuarioNome})`
                      : "Nenhum processo atribuído a você; mostrando todos"}
                  </label>
                  {estado.mostrarSomenteMeus &&
                    estado.totalSemResponsavel > 0 && (
                      <label className="mb-1">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={estado.incluirSemResponsavel}
                          onChange={(e) =>
                            acoes.setIncluirSemResponsavel(e.target.checked)
                          }
                          disabled={bloqueada}
                        />
                        Incluir processos sem responsável (
                        {estado.totalSemResponsavel})
                      </label>
                    )}
                </div>
              </div>
              <div className="d-flex align-items-center">
                <div className="text-right mr-4">
                  <div
                    className={
                      pronto
                        ? "text-bold text-primary-default"
                        : "text-bold text-muted"
                    }
                  >
                    {textoQuantidade(totalPrevisto, "documento", "documentos")}
                  </div>
                  <div className="small text-muted">
                    {textoQuantidade(
                      estado.selecionados.length,
                      "processo",
                      "processos",
                    )}{" "}
                    ×{" "}
                    {textoQuantidade(
                      estado.modelosSelecionados.length,
                      "modelo",
                      "modelos",
                    )}
                  </div>
                  <div className="small text-muted">
                    Os dados serão apresentados para conferência antes da
                    emissão.
                  </div>
                </div>
                <BrButton
                  type="button"
                  emphasis="primary"
                  onClick={acoes.acaoGerarDocumentos}
                  disabled={!pronto}
                >
                  <i
                    className={`fas ${bloqueada ? "fa-circle-notch fa-spin" : "fa-search"} mr-2`}
                    aria-hidden="true"
                  ></i>
                  {bloqueada ? "Preparando documentos..." : "Gerar documentos"}
                </BrButton>
              </div>
            </div>

            {bloqueada && (
              <div className="border rounded bg-primary-pastel-01 p-3 mb-3 d-flex align-items-center">
                <i
                  className="fas fa-circle-notch fa-spin text-primary-default mr-3"
                  aria-hidden="true"
                ></i>
                <div>
                  <div className="font-weight-bold text-primary-default">
                    Preparando os documentos
                  </div>
                  <div className="small text-muted">{estado.statusGlobal}</div>
                </div>
              </div>
            )}
            <div
              style={{
                maxHeight: "calc(100vh - 420px)",
                minHeight: 300,
                overflowY: "auto",
              }}
            >
              {estado.gruposSubcaixas.map((grupo) => (
                <div className="mb-3" key={grupo.id}>
                  <BrCard>
                    <div className="px-3 py-2 d-flex justify-content-between align-items-center bg-light border-bottom">
                      <strong className="text-primary-default">
                        {grupo.nome}
                      </strong>
                      <div className="d-flex align-items-center">
                        <span className="small text-muted mr-3">
                          {textoQuantidade(
                            grupo.processos.length,
                            "processo exibido",
                            "processos exibidos",
                          )}
                        </span>
                        <BrButton
                          type="button"
                          emphasis="tertiary"
                          density="small"
                          onClick={() =>
                            acoes.toggleGrupoProcessos(
                              grupo.processos.map((processo) => processo.id),
                            )
                          }
                          disabled={bloqueada || grupo.processos.length === 0}
                        >
                          {grupo.processos.every((processo) =>
                            estado.selecionados.includes(processo.id),
                          )
                            ? "Limpar grupo"
                            : "Selecionar grupo"}
                        </BrButton>
                      </div>
                    </div>
                    <table className="table table-hover mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th
                            className="text-center"
                            style={{ width: 50 }}
                          ></th>
                          <th>Nº do Processo</th>
                          <th>Interessado</th>
                          <th>CPF/CNPJ</th>
                          <th>Responsável</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.processos.map((processo) => {
                          const marcado = estado.selecionados.includes(
                            processo.id,
                          );
                          return (
                            <tr
                              key={processo.id}
                              className={
                                marcado
                                  ? "table-active bg-primary-pastel-01"
                                  : ""
                              }
                              onClick={() =>
                                !bloqueada && acoes.toggleProcesso(processo.id)
                              }
                              style={{
                                cursor: bloqueada ? "not-allowed" : "pointer",
                              }}
                            >
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() =>
                                    acoes.toggleProcesso(processo.id)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={bloqueada}
                                />
                              </td>
                              <td className="font-weight-bold">
                                {processo.no_do_processo}
                              </td>
                              <td>{processo.interessado || "Não informado"}</td>
                              <td>{processo.cnpj_cpf || "Não informado"}</td>
                              <td>
                                {processo.responsavel || "Sem responsável"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </BrCard>
                </div>
              ))}
              {!estado.gruposSubcaixas.length && (
                <div className="border rounded p-4 text-center bg-light">
                  <i
                    className="fas fa-inbox text-primary-default text-up-02 mb-2"
                    aria-hidden="true"
                  ></i>
                  <div className="font-weight-bold text-primary-default">
                    Nenhum processo encontrado
                  </div>
                  <div className="small text-muted mb-3">
                    Não há processos que correspondam aos filtros selecionados.
                  </div>
                  {estado.mostrarSomenteMeus && (
                    <BrButton
                      type="button"
                      emphasis="secondary"
                      density="small"
                      onClick={() => acoes.setMostrarSomenteMeus(false)}
                      disabled={bloqueada}
                    >
                      Mostrar todos os processos
                    </BrButton>
                  )}
                </div>
              )}
            </div>
            <div className="d-flex justify-content-between mt-2 small">
              <span className="text-muted">
                Os documentos serão salvos na pasta "Documentos gerados" na Área
                de Trabalho.
              </span>
              <strong className="text-primary-default">
                {textoQuantidade(
                  estado.selecionados.length,
                  "processo selecionado",
                  "processos selecionados",
                )}
              </strong>
            </div>
          </div>
        </>
      )}

      {revisaoAberta && (
        <div ref={revisaoRef}>
          <PainelValidacao
            processos={estado.processosValidados}
            onFechar={acoes.fecharValidacao}
            onAtualizarDado={acoes.atualizarDadoRevisado}
            onAlternarConferencia={acoes.alternarConferenciaProcesso}
            onConfirmarValidados={acoes.confirmarTodosValidados}
            onEmitir={acoes.executarGeracao}
            documentosPrevistos={
              estado.processosValidados.length *
              estado.modelosSelecionados.length
            }
            isGerando={estado.isGerando}
          />
        </div>
      )}

      {estado.resultadoGeracao && (
        <div ref={resultadoRef}>
          <PainelGeracao
            resultado={estado.resultadoGeracao}
            onNovaEmissao={acoes.iniciarNovaEmissao}
            onVoltarParaCorrecao={acoes.fecharGeracao}
            onAbrirPasta={acoes.abrirPasta}
          />
        </div>
      )}
    </Layout>
  );
}
