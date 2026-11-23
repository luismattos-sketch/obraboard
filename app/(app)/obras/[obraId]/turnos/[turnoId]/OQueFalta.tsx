"use client";

import { classesBotao } from "@/components/ui/Botao";
import type { GrupoFaltas } from "@/lib/dominio/faltas";
import { urlCampo } from "@/lib/dominio/link";
import type { Periodo } from "@/lib/dominio/tipos";
import { linkWhatsapp, mensagemCobranca, normalizarWhatsapp } from "@/lib/dominio/whatsapp";

type Props = {
  grupos: GrupoFaltas[];
  responsaveis: { id: string; nome: string; telefone: string | null }[];
  contexto: { obra: string; data: string; periodo: Periodo };
  /** Token do link de campo em claro (null = sem link ativo exibível). */
  token: string | null;
  /** Fim do turno "YYYY-MM-DD HH:MM" (fimDoTurno). */
  fim: string | null;
  enviado: boolean;
  terminados: string[];
};

function irPara(id: string) {
  const el = document.getElementById(`qtd-${id}`);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus();
}

function situacao(g: GrupoFaltas, p: Props): string {
  if (!g.horaDeCobrar) return "em andamento";
  if (p.enviado) return "turno enviado";
  if (g.responsavelId && p.terminados.includes(g.responsavelId)) return "terminou";
  return p.fim ? `já devia ter fechado (fim ${p.fim.slice(11)})` : "já devia ter fechado";
}

/** O que falta no registro do campo, por responsável, com cobrança pelo WhatsApp (backlog 10.4). */
export function OQueFalta(p: Props) {
  const comFalta = p.grupos.filter((g) => g.faltas.length > 0);
  return (
    <section aria-labelledby="titulo-falta" className="flex flex-col gap-3 rounded-cartao border border-borda bg-superficie p-4">
      <h2 id="titulo-falta" className="text-lg font-semibold text-primaria">O que falta</h2>
      {comFalta.length === 0 ? (
        <p className="text-sm text-texto-suave">Nada faltando ✓</p>
      ) : (
        comFalta.map((g) => {
          const r = p.responsaveis.find((x) => x.id === g.responsavelId);
          const nome = g.responsavelId === null ? "Sem responsável" : (r?.nome ?? "Responsável removido");
          const numero = r?.telefone ? normalizarWhatsapp(r.telefone) : null;
          const tel = numero?.ok ? numero.dados : null;
          const link = p.token && g.responsavelId ? `${urlCampo(p.token)}?r=${g.responsavelId}` : null;
          return (
            <div key={g.responsavelId ?? "sem"} className="flex flex-col gap-2 border-t border-borda pt-3 first-of-type:border-t-0 first-of-type:pt-0">
              <p className={g.horaDeCobrar ? "font-semibold text-alerta-escura" : "font-semibold text-texto"}>
                {nome} <span className="font-normal">— {situacao(g, p)}</span>
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {g.faltas.map((f, i) => (
                  <li key={`${f.tipo}-${f.atividadeId ?? i}`} className="flex items-center justify-between gap-2">
                    <span>• {f.texto}</span>
                    {f.atividadeId && (
                      <button
                        type="button"
                        aria-label={`Ir para: ${f.texto.split(" — ")[0]}`}
                        className="min-h-11 shrink-0 px-3 font-semibold underline"
                        onClick={() => irPara(f.atividadeId!)}
                      >
                        ir
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {r && (
                <>
                  <a
                    href={linkWhatsapp(tel, mensagemCobranca({ ...p.contexto, nome: r.nome, faltas: g.faltas, link }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${classesBotao("secundario")} min-h-11 self-start px-3 text-sm`}
                  >
                    Cobrar no WhatsApp
                  </a>
                  {!tel && <p className="text-xs text-texto-suave">Cadastre o telefone em Responsáveis da obra para abrir direto na conversa.</p>}
                  {!p.token && <p className="text-xs text-texto-suave">Gere o link de campo para mandar junto.</p>}
                </>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
