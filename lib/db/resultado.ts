export type Resultado<T = undefined> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campos?: Record<string, string> };

export function ok<T>(dados: T): Resultado<T> {
  return { ok: true, dados };
}

export function falha(erro: string, campos?: Record<string, string>): Resultado<never> {
  return campos ? { ok: false, erro, campos } : { ok: false, erro };
}
