import type { Capitulo } from "../tipos";

export const primeirosPassos: Capitulo = {
  slug: "primeiros-passos",
  titulo: "Primeiros passos",
  resumo: "Crie a conta e a obra, cadastre os responsáveis e gere o link do quadro da TV.",
  noIndice: false,
  passos: [
    {
      id: "criar-conta",
      titulo: "Crie sua conta",
      texto: [
        "Em www.frentia.com.br, clique em \"Criar conta grátis\". Informe seu nome, a empresa, o e-mail e uma senha.",
        "Confirme o e-mail pelo link que chega na sua caixa de entrada e entre com \"Entrar\".",
      ],
      dica: "Quem tem login é o planejador. Os responsáveis de campo não precisam de conta: eles usam o link do turno.",
    },
    {
      id: "minha-empresa",
      titulo: "Confira o nome da empresa",
      texto: [
        "No menu lateral, \"Minha empresa\" mostra o nome que aparece no cabeçalho de todas as páginas do RDO. Para corrigir, digite o nome novo em \"Nome da empresa (aparece no RDO)\": salva sozinho.",
        "RDOs já emitidos também saem com o nome novo quando você baixar de novo.",
      ],
      captura: {
        alt: "Página Minha empresa com o campo do nome da empresa",
        alvo: { papel: "textbox", nome: "Nome da empresa (aparece no RDO)" },
        dispositivo: "computador",
      },
    },
    {
      id: "criar-obra",
      titulo: "Crie a obra",
      texto: [
        "Na primeira vez, clique em \"Nova obra\" na tela inicial. Depois, a opção \"Nova obra\" fica no seletor de obra do menu lateral. Preencha o \"Nome da obra\", digite a cidade em \"Cidade (para o clima)\" e escolha-a na lista (é por ela que o RDO registra o clima) e, se quiser, informe o cliente e o endereço.",
        "Clique em \"Criar obra\". A obra abre e passa a aparecer no menu lateral, com as etapas Programação, Turnos, RDOs e Análise (PPC).",
      ],
      captura: {
        alt: "Formulário de nova obra com nome, cliente e endereço",
        alvo: { papel: "button", nome: "Criar obra" },
        dispositivo: "computador",
      },
    },
    {
      id: "responsaveis",
      titulo: "Cadastre os responsáveis",
      texto: [
        "Na página da obra, clique em \"Responsáveis\" para abrir a seção (o número entre parênteses é quantos estão ativos) e depois em \"+ Novo responsável\". Informe o nome e, se quiser, a especialidade (Elétrica, andaime, solda…) e o telefone, e clique em \"Salvar\". A especialidade aparece ao lado do nome no menu \"Responsável\".",
        "Responsável é quem assume as atividades no campo e lança o que foi feito pelo link do turno. Cada atividade e cada equipe do efetivo fica com um responsável.",
      ],
      dica: "Também dá para cadastrar um responsável na hora, pelo menu \"Responsável\" de qualquer atividade (opção \"+ Novo responsável…\").",
      captura: {
        alt: "Seção Responsáveis da obra com a lista e o botão de novo responsável",
        alvo: { papel: "button", nome: "+ Novo responsável" },
        dispositivo: "computador",
      },
    },
    {
      id: "link-quadro",
      titulo: "Gere o link do quadro da TV",
      texto: [
        "Ainda na página da obra, no bloco \"Link do quadro (TV / gestor)\", clique em \"Gerar link\".",
        "Use \"Copiar\" para mandar o link a quem vai abrir o quadro numa TV do canteiro, ou \"Abrir\" para ver o quadro agora. O quadro não pede login e só mostra; ninguém edita por ele.",
      ],
      captura: {
        alt: "Bloco do link do quadro com os botões Copiar e Abrir",
        alvo: { papel: "heading", nome: "Link do quadro (TV / gestor)" },
        dispositivo: "computador",
      },
    },
  ],
};
