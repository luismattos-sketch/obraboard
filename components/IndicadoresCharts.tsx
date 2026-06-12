"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const cores = ["#0b4a8f", "#ff6b00", "#2e7d32", "#c62828", "#f9a825", "#7c3aed"];

export function GraficoBarras({
  dados,
  chaves,
  layout = "horizontal",
}: {
  dados: Array<Record<string, string | number>>;
  chaves: Array<{ chave: string; nome: string; cor?: string }>;
  layout?: "horizontal" | "vertical";
}) {
  if (dados.length === 0) {
    return <EstadoGrafico />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={dados}
        layout={layout}
        margin={{ top: 8, right: 12, left: layout === "vertical" ? 32 : 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-15} height={55} />
            <YAxis tick={{ fontSize: 11 }} />
          </>
        )}
        <Tooltip formatter={(valor) => Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
        <Legend />
        {chaves.map((item, indice) => (
          <Bar
            key={item.chave}
            dataKey={item.chave}
            name={item.nome}
            fill={item.cor ?? cores[indice % cores.length]}
            radius={[5, 5, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoRosca({
  dados,
  total,
}: {
  dados: Array<{ nome: string; valor: number; cor?: string }>;
  total?: string;
}) {
  const ativos = dados.filter((item) => item.valor > 0);

  if (ativos.length === 0) {
    return <EstadoGrafico />;
  }

  return (
    <div className="relative h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={ativos}
            dataKey="valor"
            nameKey="nome"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={3}
          >
            {ativos.map((item, indice) => (
              <Cell key={item.nome} fill={item.cor ?? cores[indice % cores.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(valor) => Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {total && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="max-w-24 text-center text-sm font-bold text-slate-700">{total}</span>
        </div>
      )}
    </div>
  );
}

export function GraficoLinha({
  dados,
  chave,
  nome,
}: {
  dados: Array<Record<string, string | number>>;
  chave: string;
  nome: string;
}) {
  if (dados.length < 2) {
    return <EstadoGrafico texto="Os pontos de evolução serão exibidos conforme o campo registrar avanços." />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(valor) => Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
        <Legend />
        <Line
          type="monotone"
          dataKey={chave}
          name={nome}
          stroke="#0b4a8f"
          strokeWidth={3}
          dot={{ fill: "#ff6b00", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoMedidor({
  valor,
  referencia,
}: {
  valor: number;
  referencia: number;
}) {
  if (valor <= 0 && referencia <= 0) {
    return <EstadoGrafico />;
  }

  const percentual =
    referencia > 0 ? Math.max(0, (valor / referencia) * 100) : 0;
  const preenchimento = Math.min(100, percentual);
  const dados = [
    { nome: "Produtividade", valor: preenchimento, cor: "#2e7d32" },
    { nome: "Restante", valor: Math.max(0, 100 - preenchimento), cor: "#e2e8f0" },
  ];

  return (
    <div className="relative h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dados}
            dataKey="valor"
            nameKey="nome"
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="68%"
            innerRadius={72}
            outerRadius={100}
            stroke="none"
          >
            {dados.map((item) => (
              <Cell key={item.nome} fill={item.cor} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center">
        <p className="text-3xl font-black text-slate-900">
          {valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs font-bold uppercase text-slate-500">unidade / HH</p>
        <p className="mt-1 text-sm font-semibold text-green-700">
          {percentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do planejado
        </p>
      </div>
    </div>
  );
}

export function GraficoGantt({
  linhas,
  inicio,
  fim,
}: {
  linhas: Array<{
    id: string;
    nome: string;
    segmentos: Array<{
      inicio: number;
      fim: number;
      tipo: "ativa" | "restricao";
      descricao: string;
    }>;
    marcadores: Array<{
      instante: number;
      tipo: "restricao" | "resolucao" | "pausa";
      descricao: string;
    }>;
  }>;
  inicio: number;
  fim: number;
}) {
  if (linhas.length === 0 || fim <= inicio) {
    return <EstadoGrafico texto="Nenhuma atividade com período registrado nesta análise." />;
  }

  const duracao = fim - inicio;
  const larguraRotulo = 150;
  const larguraGrafico = 900;
  const alturaLinha = 30;
  const altura = 34 + linhas.length * alturaLinha;
  const escalaX = (instante: number) =>
    larguraRotulo + ((instante - inicio) / duracao) * (larguraGrafico - larguraRotulo - 20);
  const marcasTempo = Array.from({ length: 6 }, (_, indice) => {
    const instante = inicio + (duracao * indice) / 5;
    return {
      instante,
      x: escalaX(instante),
      rotulo: formatarEixoTempo(instante, duracao),
    };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${larguraGrafico} ${altura}`}
        className="min-w-[680px]"
        role="img"
        aria-label="Gráfico Gantt das atividades"
      >
        {marcasTempo.map((marca) => (
          <g key={marca.instante}>
            <line
              x1={marca.x}
              y1={22}
              x2={marca.x}
              y2={altura - 8}
              stroke="#dbe3ee"
              strokeDasharray="3 3"
            />
            <text
              x={marca.x}
              y={13}
              textAnchor="middle"
              fontSize="7"
              fill="#64748b"
            >
              {marca.rotulo}
            </text>
          </g>
        ))}

        {linhas.map((linha, indice) => {
          const y = 25 + indice * alturaLinha;
          return (
            <g key={linha.id}>
              <text
                x={larguraRotulo - 10}
                y={y + 13}
                textAnchor="end"
                fontSize="7.5"
                fontWeight="400"
                fill="#334155"
              >
                {abreviarTexto(linha.nome, 22)}
              </text>
              <line
                x1={larguraRotulo}
                y1={y + 9}
                x2={larguraGrafico - 20}
                y2={y + 9}
                stroke="#eef2f6"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {linha.segmentos.map((segmento, segmentoIndice) => (
                <rect
                  key={`${linha.id}-${segmentoIndice}`}
                  x={escalaX(segmento.inicio)}
                  y={y + 5}
                  width={Math.max(3, escalaX(segmento.fim) - escalaX(segmento.inicio))}
                  height={8}
                  rx={3}
                  fill={segmento.tipo === "ativa" ? "#2e7d32" : "#c62828"}
                >
                  <title>{segmento.descricao}</title>
                </rect>
              ))}
              {linha.marcadores.map((marcador, marcadorIndice) => {
                const x = escalaX(marcador.instante);
                const cor =
                  marcador.tipo === "restricao"
                    ? "#c62828"
                    : marcador.tipo === "resolucao"
                      ? "#0b4a8f"
                      : "#f9a825";
                return (
                  <g key={`${linha.id}-marcador-${marcadorIndice}`}>
                    <line
                      x1={x}
                      y1={y}
                      x2={x}
                      y2={y + 17}
                      stroke={cor}
                      strokeWidth="1.5"
                    />
                    <circle cx={x} cy={y + 2} r={2.75} fill={cor}>
                      <title>{marcador.descricao}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-2.5 text-[8px] font-normal text-slate-600">
        <Legenda cor="#2e7d32" texto="Atividade ativa" />
        <Legenda cor="#c62828" texto="Em restrição" />
        <Legenda cor="#f9a825" texto="Parada" marcador />
        <Legenda cor="#0b4a8f" texto="Restrição resolvida" marcador />
      </div>
    </div>
  );
}

function Legenda({
  cor,
  texto,
  marcador = false,
}: {
  cor: string;
  texto: string;
  marcador?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={marcador ? "h-2.5 w-0.5 rounded-full" : "h-1.5 w-4 rounded"}
        style={{ backgroundColor: cor }}
      />
      {texto}
    </span>
  );
}

function formatarEixoTempo(instante: number, duracao: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...(duracao >= 86_400_000 ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instante));
}

function abreviarTexto(texto: string, limite: number) {
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

function EstadoGrafico({ texto = "Dados insuficientes para gerar este gráfico." }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
      {texto}
    </div>
  );
}
