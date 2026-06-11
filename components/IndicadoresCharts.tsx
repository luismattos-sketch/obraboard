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
    <ResponsiveContainer width="100%" height={300}>
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
    <div className="relative h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={ativos}
            dataKey="valor"
            nameKey="nome"
            innerRadius={70}
            outerRadius={105}
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
    <ResponsiveContainer width="100%" height={300}>
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

function EstadoGrafico({ texto = "Dados insuficientes para gerar este gráfico." }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
      {texto}
    </div>
  );
}
