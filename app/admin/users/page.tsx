"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DesktopLayout from "../../../components/DesktopLayout";
import { supabase } from "../../../lib/supabase";

type AccessStatus =
  | "active"
  | "suspended"
  | "cancelled"
  | "banned"
  | "deleted_pending"
  | "deleted";

type AdminUser = {
  userId: string;
  accountId: string | null;
  name: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  role: string | null;
  accountName: string | null;
  accessStatus: AccessStatus;
  subscriptionStatus: string;
  plan: string;
  manualBlockReason: string | null;
  bannedReason: string | null;
  counts: {
    obras: number;
    turnos: number;
    atividades: number;
    restricoes: number;
    rdos: number;
  };
};

type AuditLog = {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  adminEmail: string;
  targetEmail: string;
};

type ModalState = {
  action: string;
  user: AdminUser;
} | null;

const planos = ["free", "trial", "basic", "premium", "enterprise"];
const assinaturas = ["inactive", "trialing", "active", "past_due", "cancelled"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("all");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmacaoEmail, setConfirmacaoEmail] = useState("");
  const [plano, setPlano] = useState("free");
  const [assinatura, setAssinatura] = useState("inactive");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await chamarApiAdmin();
      setUsers(resposta.users ?? []);
      setAuditLogs(resposta.auditLogs ?? []);
    } catch (error) {
      setMensagem(mensagemErro(error));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void carregar();
    });
  }, [carregar]);

  const usersFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return users.filter((user) => {
      const correspondeBusca =
        !termo ||
        user.email.toLowerCase().includes(termo) ||
        user.name.toLowerCase().includes(termo) ||
        user.userId.toLowerCase().includes(termo);
      const correspondeFiltro =
        filtro === "all" || user.accessStatus === filtro;
      return correspondeBusca && correspondeFiltro;
    });
  }, [busca, filtro, users]);

  const resumo = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.accessStatus === "active").length,
      suspended: users.filter((user) => user.accessStatus === "suspended").length,
      cancelled: users.filter((user) => user.accessStatus === "cancelled").length,
      banned: users.filter((user) => user.accessStatus === "banned").length,
    }),
    [users]
  );

  function abrirModal(action: string, user: AdminUser) {
    setModal({ action, user });
    setMotivo("");
    setConfirmacaoEmail("");
    setPlano(user.plan);
    setAssinatura(user.subscriptionStatus);
    setMensagem("");
  }

  async function executarAcao() {
    if (!modal?.user.accountId) {
      setMensagem("A conta vinculada não foi encontrada.");
      return;
    }

    setProcessando(true);
    setMensagem("");

    try {
      await chamarApiAdmin({
        action: modal.action,
        userId: modal.user.userId,
        accountId: modal.user.accountId,
        email: modal.user.email,
        reason: motivo,
        confirmationEmail: confirmacaoEmail,
        plan: modal.action === "billing" ? plano : undefined,
        subscriptionStatus:
          modal.action === "billing" ? assinatura : undefined,
      });
      setModal(null);
      setMensagem("Ação administrativa concluída.");
      await carregar();
    } catch (error) {
      setMensagem(mensagemErro(error));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <DesktopLayout
      titulo="Gerenciamento de Usuários"
      subtitulo="Painel interno de contas, acesso e assinatura"
    >
      <div className="space-y-5">
        {mensagem && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {mensagem}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ResumoCard titulo="Usuários" valor={resumo.total} />
          <ResumoCard titulo="Ativos" valor={resumo.active} tom="green" />
          <ResumoCard titulo="Suspensos" valor={resumo.suspended} tom="amber" />
          <ResumoCard titulo="Cancelados" valor={resumo.cancelled} tom="slate" />
          <ResumoCard titulo="Banidos" valor={resumo.banned} tom="red" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome, e-mail ou user_id"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />
            <select
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="suspended">Suspensos</option>
              <option value="cancelled">Cancelados</option>
              <option value="banned">Banidos</option>
              <option value="deleted_pending">Exclusão pendente</option>
            </select>
            <button
              type="button"
              onClick={() => void carregar()}
              className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1500px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">IDs</th>
                  <th className="p-3">Cadastro / login</th>
                  <th className="p-3">Acesso</th>
                  <th className="p-3">Plano / assinatura</th>
                  <th className="p-3">Dados</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersFiltrados.map((user) => (
                  <tr key={user.userId} className="border-t align-top">
                    <td className="p-3">
                      <p className="font-bold text-slate-900">
                        {user.name || "Nome não informado"}
                      </p>
                      <p className="text-slate-600">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {user.accountName || "Conta sem nome"}
                      </p>
                    </td>
                    <td className="max-w-72 p-3 font-mono text-[11px] text-slate-500">
                      <p className="break-all">user: {user.userId}</p>
                      <p className="mt-1 break-all">
                        account: {user.accountId || "-"}
                      </p>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <p>{formatarData(user.createdAt)}</p>
                      <p className="mt-1">
                        Login: {formatarData(user.lastSignInAt)}
                      </p>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={user.accessStatus} />
                      {(user.manualBlockReason || user.bannedReason) && (
                        <p className="mt-2 max-w-52 text-xs text-slate-500">
                          {user.bannedReason || user.manualBlockReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{user.plan}</p>
                      <p className="text-xs text-slate-500">
                        {user.subscriptionStatus}
                      </p>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <p>{user.counts.obras} frentes · {user.counts.turnos} turnos</p>
                      <p>{user.counts.atividades} atividades</p>
                      <p>{user.counts.restricoes} restrições · {user.counts.rdos} RDOs</p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {user.accessStatus === "active" && (
                          <>
                            <Acao onClick={() => abrirModal("suspended", user)}>
                              Suspender
                            </Acao>
                            <Acao onClick={() => abrirModal("cancelled", user)}>
                              Cancelar
                            </Acao>
                          </>
                        )}
                        {["suspended", "cancelled"].includes(user.accessStatus) && (
                          <Acao onClick={() => abrirModal("active", user)}>
                            Autorizar acesso
                          </Acao>
                        )}
                        {user.accessStatus === "banned" ? (
                          <Acao onClick={() => abrirModal("unban", user)}>
                            Remover banimento
                          </Acao>
                        ) : (
                          <Acao onClick={() => abrirModal("ban", user)}>
                            Banir e-mail
                          </Acao>
                        )}
                        <Acao onClick={() => abrirModal("billing", user)}>
                          Plano
                        </Acao>
                        <Acao
                          danger
                          onClick={() => abrirModal("delete", user)}
                        >
                          Deletar conta
                        </Acao>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!carregando && usersFiltrados.length === 0 && (
              <p className="py-10 text-center text-slate-500">
                Nenhum usuário encontrado.
              </p>
            )}
            {carregando && (
              <p className="py-10 text-center font-semibold text-slate-500">
                Carregando usuários...
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Histórico administrativo</h2>
          <div className="mt-4 space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-1 rounded-xl border border-slate-200 p-3 text-sm md:grid-cols-[180px_1fr_1fr]"
              >
                <span className="text-slate-500">
                  {formatarData(log.created_at)}
                </span>
                <span className="font-semibold">{rotuloAcao(log.action)}</span>
                <span className="text-slate-600">
                  {log.targetEmail || "-"}
                  {log.reason ? ` · ${log.reason}` : ""}
                </span>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhuma ação administrativa registrada.
              </p>
            )}
          </div>
        </section>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">
              {tituloModal(modal.action)}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {modal.user.email}
            </p>

            {modal.action === "delete" && (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <p className="font-bold">Esta ação é irreversível.</p>
                <p className="mt-2">
                  Serão removidas {modal.user.counts.obras} frentes,{" "}
                  {modal.user.counts.turnos} turnos,{" "}
                  {modal.user.counts.atividades} atividades,{" "}
                  {modal.user.counts.restricoes} restrições e{" "}
                  {modal.user.counts.rdos} RDOs desta conta.
                </p>
              </div>
            )}

            {modal.action === "billing" ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Plano
                  </span>
                  <select
                    value={plano}
                    onChange={(event) => setPlano(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3"
                  >
                    {planos.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Assinatura
                  </span>
                  <select
                    value={assinatura}
                    onChange={(event) => setAssinatura(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3"
                  >
                    {assinaturas.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="mt-5 block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                  Motivo
                </span>
                <textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 p-3"
                  placeholder="Registre o motivo da ação administrativa"
                />
              </label>
            )}

            {modal.action === "delete" && (
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-bold uppercase text-red-600">
                  Digite o e-mail para confirmar
                </span>
                <input
                  value={confirmacaoEmail}
                  onChange={(event) => setConfirmacaoEmail(event.target.value)}
                  className="w-full rounded-xl border border-red-300 p-3"
                />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={processando}
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-600"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void executarAcao()}
                disabled={
                  processando ||
                  (modal.action === "delete" &&
                    confirmacaoEmail.trim().toLowerCase() !==
                      modal.user.email.toLowerCase())
                }
                className={`rounded-xl px-5 py-3 font-bold text-white disabled:bg-slate-400 ${
                  modal.action === "delete" ? "bg-red-600" : "bg-teal-600"
                }`}
              >
                {processando ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DesktopLayout>
  );
}

async function chamarApiAdmin(payload?: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sessão administrativa não encontrada.");
  }

  const resposta = await fetch("/api/admin/users", {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const dados = (await resposta.json()) as {
    error?: string;
    users?: AdminUser[];
    auditLogs?: AuditLog[];
  };

  if (!resposta.ok) {
    throw new Error(dados.error || "Falha ao carregar a administração.");
  }

  return dados;
}

function ResumoCard({
  titulo,
  valor,
  tom = "teal",
}: {
  titulo: string;
  valor: number;
  tom?: "teal" | "green" | "amber" | "slate" | "red";
}) {
  const cores = {
    teal: "bg-teal-50 text-teal-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-200 text-slate-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${cores[tom]}`}>
      <p className="text-xs font-bold uppercase">{titulo}</p>
      <p className="mt-2 text-3xl font-black">{valor}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AccessStatus }) {
  const classes: Record<AccessStatus, string> = {
    active: "bg-green-100 text-green-700",
    suspended: "bg-amber-100 text-amber-700",
    cancelled: "bg-slate-200 text-slate-700",
    banned: "bg-red-100 text-red-700",
    deleted_pending: "bg-orange-100 text-orange-700",
    deleted: "bg-slate-900 text-white",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${classes[status]}`}>
      {status}
    </span>
  );
}

function Acao({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
        danger
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-300 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function formatarData(data: string | null) {
  if (!data) return "-";
  return new Date(data).toLocaleString("pt-BR");
}

function tituloModal(action: string) {
  const titulos: Record<string, string> = {
    active: "Autorizar acesso",
    suspended: "Suspender conta",
    cancelled: "Cancelar acesso",
    ban: "Banir e-mail",
    unban: "Remover banimento",
    billing: "Plano e assinatura",
    delete: "Deletar conta",
  };
  return titulos[action] ?? "Ação administrativa";
}

function rotuloAcao(action: string) {
  const rotulos: Record<string, string> = {
    access_status_changed: "Status de acesso alterado",
    plan_changed: "Plano alterado",
    subscription_status_changed: "Assinatura alterada",
    email_banned: "E-mail banido",
    email_unbanned: "Banimento removido",
    account_deleted: "Conta deletada",
  };
  return rotulos[action] ?? action;
}

function mensagemErro(error: unknown) {
  return error instanceof Error ? error.message : "Falha na operação administrativa.";
}
