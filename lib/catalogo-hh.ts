import type { CatalogoHH } from "./types";

export function normalizarCatalogoHH(item: CatalogoHH): CatalogoHH {
  return {
    ...item,
    indice_hh: numeroSeguro(item.indice_hh),
  };
}

export function numeroSeguro(valor: unknown) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor !== "string") {
    return 0;
  }

  const texto = valor.trim();
  if (!texto) {
    return 0;
  }

  const semEspacos = texto.replace(/\s/g, "");
  const temVirgula = semEspacos.includes(",");
  const normalizado = temVirgula
    ? semEspacos.replace(/\./g, "").replace(",", ".")
    : semEspacos;
  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
}

export function calcularHHPlanejado(quantidade: unknown, indice: unknown) {
  const quantidadeNumerica = numeroSeguro(quantidade);
  const indiceNumerico = numeroSeguro(indice);
  const resultado = quantidadeNumerica * indiceNumerico;

  return resultado > 0 && Number.isFinite(resultado) ? resultado : 0;
}

export function formatarNumeroPtBR(
  valor: unknown,
  casas: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
) {
  const numero = numeroSeguro(valor);

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: casas.minimumFractionDigits ?? 0,
    maximumFractionDigits: casas.maximumFractionDigits ?? 4,
  });
}
