"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type SuporteThread = {
  id: string;
  empresaId: string;
  userId: string;
  assunto: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
  clienteNome?: string;
  clienteEmail?: string;
  empresaNome?: string;
  ultimaMensagem?: string;
};

type SuporteMensagem = {
  id: string;
  threadId: string;
  autorTipo: "cliente" | "superadmin";
  autorNome: string;
  mensagem: string;
  createdAt: string;
};

type Props = {
  aberto?: boolean;
  flutuante?: boolean;
  onClose?: () => void;
};

export default function SuporteChat({
  aberto = true,
  flutuante = false,
  onClose,
}: Props) {
  const [appAdmin, setAppAdmin] = useState(false);
  const [thread, setThread] = useState<SuporteThread | null>(null);
  const [threads, setThreads] = useState<SuporteThread[]>([]);
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const tituloCampo = appAdmin
    ? "Responder como Luis do Frentia"
    : "Escreva sua mensagem para o suporte";

  const threadSelecionada = useMemo(() => {
    if (!appAdmin) {
      return thread;
    }

    return threads.find((item) => item.id === thread?.id) ?? threads[0] ?? null;
  }, [appAdmin, thread, threads]);

  const carregarMensagens = useCallback(async (threadId: string) => {
    const { data, error } = await supabase.rpc("suporte_listar_mensagens", {
      p_thread_id: threadId,
    });

    if (error) {
      throw error;
    }

    setMensagens(normalizarMensagens(data));
  }, []);

  const carregarAdmin = useCallback(async () => {
    const { data, error } = await supabase.rpc("suporte_listar_threads_admin");

    if (error) {
      throw error;
    }

    const lista = normalizarThreads(data);
    setThreads(lista);

    const selecionada =
      lista.find((item) => item.id === thread?.id) ?? lista[0] ?? null;
    setThread(selecionada);

    if (selecionada) {
      await carregarMensagens(selecionada.id);
    } else {
      setMensagens([]);
    }
  }, [carregarMensagens, thread?.id]);

  const carregarCliente = useCallback(async () => {
    const { data, error } = await supabase.rpc("suporte_obter_ou_criar_thread");

    if (error) {
      throw error;
    }

    const conversa = normalizarThread(data);
    setThread(conversa);

    if (conversa) {
      await carregarMensagens(conversa.id);
    }
  }, [carregarMensagens]);

  const carregar = useCallback(async () => {
    setErro("");

    try {
      const { data: admin } = await supabase.rpc("is_app_admin");
      const ehAdmin = Boolean(admin);
      setAppAdmin(ehAdmin);

      if (ehAdmin) {
        await carregarAdmin();
      } else {
        await carregarCliente();
      }
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setCarregando(false);
    }
  }, [carregarAdmin, carregarCliente]);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    queueMicrotask(() => {
      void carregar();
    });
  }, [aberto, carregar]);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const intervalo = window.setInterval(() => {
      if (threadSelecionada) {
        void carregarMensagens(threadSelecionada.id).catch((error) => {
          setErro(mensagemErro(error));
        });
      }

      if (appAdmin) {
        void carregarAdmin().catch((error) => {
          setErro(mensagemErro(error));
        });
      }
    }, 12000);

    return () => window.clearInterval(intervalo);
  }, [aberto, appAdmin, carregarAdmin, carregarMensagens, threadSelecionada]);

  async function selecionarThread(item: SuporteThread) {
    setThread(item);
    setErro("");
    setCarregando(true);

    try {
      await carregarMensagens(item.id);
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setCarregando(false);
    }
  }

  async function enviarMensagem() {
    const mensagem = texto.trim();

    if (!mensagem || enviando) {
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const threadId = threadSelecionada?.id ?? null;
      const { error } = await supabase.rpc("suporte_enviar_mensagem", {
        p_thread_id: threadId,
        p_mensagem: mensagem,
      });

      if (error) {
        throw error;
      }

      setTexto("");
      await carregar();
    } catch (error) {
      setErro(mensagemErro(error));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return null;
  }

  const conteudo = (
    <div
      data-readonly-allow="true"
      className={`grid gap-4 ${
        flutuante
          ? appAdmin
            ? "h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[260px_1fr]"
            : "h-full min-h-0 grid-cols-1 overflow-hidden"
          : "xl:grid-cols-[340px_1fr]"
      }`}
    >
      {appAdmin && (
        <section className="min-h-0 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Conversas</h3>
              <p className="text-sm text-slate-500">
                {threads.length} atendimento(s)
              </p>
            </div>

            <button
              type="button"
              onClick={() => void carregar()}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
            >
              Atualizar
            </button>
          </div>

          <div className="max-h-full space-y-2 overflow-auto pr-1">
            {threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">
                Nenhuma conversa aberta ainda.
              </div>
            ) : (
              threads.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void selecionarThread(item)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    item.id === threadSelecionada?.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {item.clienteNome || "Usuario"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.clienteEmail || "E-mail nao informado"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {item.ultimaMensagem || "Sem mensagens ainda."}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatarDataHora(item.lastMessageAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      <section className="min-w-0 flex min-h-0 flex-col rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {appAdmin
                  ? threadSelecionada?.clienteNome || "Selecione uma conversa"
                  : "Atendimento com Luis do Frentia"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {appAdmin
                  ? threadSelecionada?.clienteEmail || "Escolha uma conversa para responder."
                  : "As mensagens ficam registradas nesta conta."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {threadSelecionada && (
                <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold uppercase text-blue-700">
                  {threadSelecionada.status}
                </span>
              )}

              {flutuante && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-100"
                  aria-label="Fechar suporte"
                >
                  x
                </button>
              )}
            </div>
          </div>
        </div>

        {erro && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {carregando ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Carregando suporte...
            </div>
          ) : mensagens.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">
              Ainda nao ha mensagens. Envie a primeira para iniciar o atendimento.
            </div>
          ) : (
            mensagens.map((item) => {
              const suporte = item.autorTipo === "superadmin";

              return (
                <div
                  key={item.id}
                  className={`flex ${suporte ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-full rounded-2xl px-4 py-3 shadow-sm sm:max-w-[760px] ${
                      suporte
                        ? "bg-slate-100 text-slate-900"
                        : "bg-orange-500 text-white"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span>{item.autorNome}</span>
                      <span className={suporte ? "text-slate-400" : "text-orange-100"}>
                        {formatarDataHora(item.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {item.mensagem}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
              {tituloCampo}
            </span>
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Digite sua mensagem..."
              rows={flutuante ? 3 : 4}
              className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {appAdmin
                ? "A resposta sera enviada com o nome Luis do Frentia."
                : "Voce pode continuar usando o app enquanto conversa."}
            </p>
            <button
              type="button"
              onClick={() => void enviarMensagem()}
              disabled={!texto.trim() || enviando || (appAdmin && !threadSelecionada)}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {enviando ? "Enviando..." : "Enviar mensagem"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  if (!flutuante) {
    return conteudo;
  }

  return (
    <div className="fixed inset-2 z-50 h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-slate-200 backdrop-blur print:hidden sm:inset-x-auto sm:bottom-3 sm:right-5 sm:top-auto sm:h-[78vh] sm:max-h-[760px] sm:w-[430px] sm:p-3 lg:w-[520px] xl:w-[780px]">
      {conteudo}
    </div>
  );
}

function normalizarThread(valor: unknown): SuporteThread | null {
  if (!valor || typeof valor !== "object" || !("id" in valor)) {
    return null;
  }

  const item = valor as Record<string, unknown>;
  return {
    id: String(item.id ?? ""),
    empresaId: String(item.empresaId ?? ""),
    userId: String(item.userId ?? ""),
    assunto: String(item.assunto ?? "Suporte Frentia"),
    status: String(item.status ?? "aberto"),
    lastMessageAt: String(item.lastMessageAt ?? ""),
    createdAt: String(item.createdAt ?? ""),
    clienteNome: textoOpcional(item.clienteNome),
    clienteEmail: textoOpcional(item.clienteEmail),
    empresaNome: textoOpcional(item.empresaNome),
    ultimaMensagem: textoOpcional(item.ultimaMensagem),
  };
}

function normalizarThreads(valor: unknown): SuporteThread[] {
  return Array.isArray(valor)
    ? valor.map(normalizarThread).filter((item): item is SuporteThread => Boolean(item?.id))
    : [];
}

function normalizarMensagens(valor: unknown): SuporteMensagem[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.map((item) => {
    const linha = item as Record<string, unknown>;
    const autorTipo = String(linha.autorTipo ?? "cliente");

    return {
      id: String(linha.id ?? ""),
      threadId: String(linha.threadId ?? ""),
      autorTipo: autorTipo === "superadmin" ? "superadmin" : "cliente",
      autorNome: String(linha.autorNome ?? "Usuario"),
      mensagem: String(linha.mensagem ?? ""),
      createdAt: String(linha.createdAt ?? ""),
    };
  });
}

function textoOpcional(valor: unknown) {
  return typeof valor === "string" ? valor : undefined;
}

function formatarDataHora(valor: string) {
  if (!valor) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

function mensagemErro(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Nao foi possivel carregar o suporte agora.";
}
