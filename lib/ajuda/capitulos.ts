// Lista ordenada dos capítulos do manual e navegação entre eles (regras puras, testáveis).
import type { Capitulo, SlugCapitulo } from "./tipos";
import { primeirosPassos } from "./conteudo/primeiros-passos";
import { metodoLps } from "./conteudo/metodo-lps";
import { programarSemana } from "./conteudo/programar-semana";
import { checkIn } from "./conteudo/check-in";
import { duranteOTurno } from "./conteudo/durante-o-turno";
import { fecharTurno } from "./conteudo/fechar-turno";
import { encerrarSemana } from "./conteudo/encerrar-semana";
import { quadroTv } from "./conteudo/quadro-tv";
import { duvidas } from "./conteudo/duvidas";
import { campo } from "./conteudo/campo";

export const CAPITULOS: Capitulo[] = [
  primeirosPassos,
  metodoLps,
  programarSemana,
  checkIn,
  duranteOTurno,
  fecharTurno,
  encerrarSemana,
  quadroTv,
  duvidas,
  campo,
];

export const capituloPorSlug = (slug: string): Capitulo | undefined => CAPITULOS.find((c) => c.slug === slug);

export const capitulosDoIndice = (): Capitulo[] => CAPITULOS.filter((c) => !c.noIndice);

/** Capítulo seguinte no índice; null no último e nos capítulos fora do índice. */
export function proximoCapitulo(slug: SlugCapitulo): Capitulo | null {
  const indice = capitulosDoIndice();
  const i = indice.findIndex((c) => c.slug === slug);
  return i >= 0 && i < indice.length - 1 ? indice[i + 1] : null;
}

export const hrefPasso = (slug: SlugCapitulo, passoId?: string): string =>
  passoId ? `/ajuda/${slug}#${passoId}` : `/ajuda/${slug}`;

/** Caminho público da captura de um passo (arquivo em public/ajuda/). */
export const caminhoCaptura = (slug: SlugCapitulo, passoId: string): string => `/ajuda/${slug}-${passoId}.png`;
