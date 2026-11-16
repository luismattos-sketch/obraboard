export type Resultado<T = undefined> =
  | { ok: true; dados: T }
  | {
      ok: false;
      erro: string;
      campos?: Record<string, string>;
      /** Gravação recusada porque o valor mudou em outra tela; `atual` = o que está gravado agora (quando conhecido). */
      conflito?: { atual?: unknown };
    };

export function ok<T>(dados: T): Resultado<T> {
  return { ok: true, dados };
}

export function falha(erro: string, campos?: Record<string, string>): Resultado<never> {
  return campos ? { ok: false, erro, campos } : { ok: false, erro };
}

export function falhaConflito(erro: string, atual?: unknown): Resultado<never> {
  return { ok: false, erro, conflito: atual === undefined ? {} : { atual } };
}
