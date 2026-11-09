export type PlanoCodigo = "free" | "trial" | "basic" | "premium" | "enterprise";

export type PlanoComercial = {
  codigo: PlanoCodigo;
  nome: string;
  preco: number;
  limites: {
    frentesAtivas: number | null;
    planejadores: number | null;
    visitantes: number | null;
  };
};

export const planosComerciais: Record<PlanoCodigo, PlanoComercial> = {
  free: {
    codigo: "free",
    nome: "Starter",
    preco: 129,
    limites: { frentesAtivas: 1, planejadores: 1, visitantes: 1 },
  },
  trial: {
    codigo: "trial",
    nome: "Starter",
    preco: 129,
    limites: { frentesAtivas: 1, planejadores: 1, visitantes: 1 },
  },
  basic: {
    codigo: "basic",
    nome: "Starter",
    preco: 129,
    limites: { frentesAtivas: 1, planejadores: 1, visitantes: 1 },
  },
  premium: {
    codigo: "premium",
    nome: "Profissional",
    preco: 249,
    limites: { frentesAtivas: 3, planejadores: 3, visitantes: 3 },
  },
  enterprise: {
    codigo: "enterprise",
    nome: "Empresarial",
    preco: 499,
    limites: { frentesAtivas: null, planejadores: null, visitantes: null },
  },
};

export const planosAssinatura: PlanoCodigo[] = ["basic", "premium", "enterprise"];

export function normalizarPlano(codigo: string | null | undefined): PlanoCodigo {
  if (
    codigo === "trial" ||
    codigo === "basic" ||
    codigo === "premium" ||
    codigo === "enterprise"
  ) {
    return codigo;
  }

  return "free";
}

export function obterPlano(codigo: string | null | undefined) {
  return planosComerciais[normalizarPlano(codigo)];
}

export async function obterPlanoContaAtual() {
  const [{ obterEmpresaAtualId }, { supabase }] = await Promise.all([
    import("./conta"),
    import("./supabase"),
  ]);
  const empresaId = await obterEmpresaAtualId();

  if (!empresaId) {
    return planosComerciais.free;
  }

  const { data, error } = await supabase
    .from("empresas")
    .select("plan")
    .eq("id", empresaId)
    .maybeSingle();

  if (error) {
    console.warn("Nao foi possivel carregar plano da conta.", error);
    return planosComerciais.free;
  }

  return obterPlano(String(data?.plan ?? "free"));
}

export function descreverLimite(valor: number | null) {
  return valor === null ? "ilimitado" : String(valor);
}
