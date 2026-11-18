// Tipos do manual do usuário (conteúdo versionado junto com o código).

export type SlugCapitulo =
  | "primeiros-passos"
  | "programar-semana"
  | "check-in"
  | "durante-o-turno"
  | "fechar-turno"
  | "encerrar-semana"
  | "quadro-tv"
  | "duvidas"
  | "campo";

/** Quem faz o passo no fluxograma: planejador, responsável de campo ou o quadro na TV. */
export type Ator = "planejador" | "campo" | "tv";

/** Elemento que a captura destaca; o roteiro de capturas falha se ele sumir da tela. */
export type Alvo = {
  papel: "button" | "link" | "heading" | "textbox" | "combobox" | "checkbox";
  nome: string;
};

export type Captura = { alt: string; alvo: Alvo; dispositivo: "computador" | "celular" };

export type Passo = { id: string; titulo: string; texto: string[]; dica?: string; captura?: Captura };

export type Capitulo = {
  slug: SlugCapitulo;
  titulo: string;
  resumo: string;
  /** true = não aparece no índice do planejador (ex.: o "Como usar" do campo). */
  noIndice: boolean;
  passos: Passo[];
};

export type CaixaFluxo = { rotulo: string; detalhe?: string; ator: Ator; href: string };

export type FaseFluxo = { titulo: string; linhas: CaixaFluxo[][]; nota?: string };

export type Novidade = { data: string /* YYYY-MM-DD */; texto: string; href: string };
