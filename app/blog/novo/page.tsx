"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import DesktopLayout from "../../../components/DesktopLayout";
import { criarSlugBlog, usuarioPodeEditarBlog, type BlogPost } from "../../../lib/blog";
import { supabase } from "../../../lib/supabase";

export default function NovoPostBlogPage() {
  const [permitido, setPermitido] = useState(false);
  const [carregandoAcesso, setCarregandoAcesso] = useState(true);
  const [carregandoPosts, setCarregandoPosts] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [resumo, setResumo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [salvando, setSalvando] = useState(false);
  const [postEmEdicaoId, setPostEmEdicaoId] = useState("");
  const [acaoPostId, setAcaoPostId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const conteudoRef = useRef<HTMLTextAreaElement>(null);

  async function obterTokenSessao() {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? "";
  }

  const carregarPosts = useCallback(async () => {
    setCarregandoPosts(true);
    const token = await obterTokenSessao();

    if (!token) {
      setMensagem("Sessão expirada. Entre novamente para carregar os posts.");
      setCarregandoPosts(false);
      return;
    }

    const resposta = await fetch("/api/blog/posts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await resposta.json();

    setCarregandoPosts(false);

    if (!resposta.ok) {
      setMensagem(payload.error ?? "Não foi possível carregar os posts.");
      return;
    }

    setPosts((payload.posts ?? []) as BlogPost[]);
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const acesso = usuarioPodeEditarBlog(data.user?.email);
      setPermitido(acesso);
      setCarregandoAcesso(false);

      if (!acesso) {
        setMensagem("A criação de posts está liberada apenas para luismattos@gmail.com.");
        return;
      }

      void carregarPosts();
    });
  }, [carregarPosts]);

  async function salvarPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!permitido) {
      return;
    }

    setSalvando(true);
    setMensagem("");

    const token = await obterTokenSessao();

    if (!token) {
      setMensagem("Sessão expirada. Entre novamente para publicar.");
      setSalvando(false);
      return;
    }

    const resposta = await fetch("/api/blog/posts", {
      method: postEmEdicaoId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: postEmEdicaoId,
        title: titulo,
        slug,
        excerpt: resumo,
        content: conteudo,
        status,
      }),
    });
    const payload = await resposta.json();

    setSalvando(false);

    if (!resposta.ok) {
      setMensagem(payload.error ?? "Não foi possível salvar o post.");
      return;
    }

    setMensagem(postEmEdicaoId ? "Post atualizado com sucesso." : "Post salvo com sucesso.");
    limparFormulario();
    await carregarPosts();
  }

  function editarPost(post: BlogPost) {
    setPostEmEdicaoId(post.id);
    setTitulo(post.title);
    setSlug(post.slug);
    setResumo(post.excerpt ?? "");
    setConteudo(post.content);
    setStatus(post.status);
    setMensagem("Editando post selecionado.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function limparFormulario() {
    setPostEmEdicaoId("");
    setTitulo("");
    setSlug("");
    setResumo("");
    setConteudo("");
    setStatus("draft");
  }

  function aplicarFormato(prefixo: string, sufixo: string, textoPadrao: string) {
    const textarea = conteudoRef.current;

    if (!textarea) {
      setConteudo((valorAtual) => `${valorAtual}${prefixo}${textoPadrao}${sufixo}`);
      return;
    }

    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const selecionado = conteudo.slice(inicio, fim) || textoPadrao;
    const novoConteudo = `${conteudo.slice(0, inicio)}${prefixo}${selecionado}${sufixo}${conteudo.slice(fim)}`;
    const cursorInicio = inicio + prefixo.length;
    const cursorFim = cursorInicio + selecionado.length;

    setConteudo(novoConteudo);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorInicio, cursorFim);
    }, 0);
  }

  function aplicarBulletPoint() {
    const textarea = conteudoRef.current;

    if (!textarea) {
      setConteudo((valorAtual) => `${valorAtual}\n- novo item`);
      return;
    }

    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const selecionado = conteudo.slice(inicio, fim) || "novo item";
    const lista = selecionado
      .split("\n")
      .map((linha) => {
        const texto = linha.trim();
        return texto.startsWith("- ") ? texto : `- ${texto || "novo item"}`;
      })
      .join("\n");
    const separadorAntes = inicio > 0 && !conteudo.slice(0, inicio).endsWith("\n") ? "\n" : "";
    const separadorDepois = fim < conteudo.length && !conteudo.slice(fim).startsWith("\n") ? "\n" : "";
    const novoConteudo = `${conteudo.slice(0, inicio)}${separadorAntes}${lista}${separadorDepois}${conteudo.slice(fim)}`;
    const cursorInicio = inicio + separadorAntes.length;

    setConteudo(novoConteudo);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorInicio, cursorInicio + lista.length);
    }, 0);
  }

  function inserirImagem() {
    const url = window.prompt("Cole a URL da imagem:");

    if (!url) {
      return;
    }

    let imagemUrl = "";

    try {
      const urlValidada = new URL(url.trim());

      if (urlValidada.protocol !== "http:" && urlValidada.protocol !== "https:") {
        setMensagem("Use uma URL de imagem iniciada por http ou https.");
        return;
      }

      imagemUrl = urlValidada.toString();
    } catch {
      setMensagem("URL de imagem invalida.");
      return;
    }

    const alt = window.prompt("Texto alternativo da imagem:", "Imagem do post") || "Imagem do post";
    aplicarFormato("![", `](${imagemUrl})`, alt);
  }

  async function publicarPost(post: BlogPost) {
    await executarAcaoPost(post.id, "PATCH", {
      id: post.id,
      action: "publish",
      status: "published",
      published_at: post.published_at,
    });
  }

  async function excluirPost(post: BlogPost) {
    const confirmou = window.confirm(`Excluir o post "${post.title}"?`);

    if (!confirmou) {
      return;
    }

    await executarAcaoPost(post.id, "DELETE", { id: post.id });
  }

  async function executarAcaoPost(
    postId: string,
    method: "PATCH" | "DELETE",
    body: Record<string, string | null>
  ) {
    if (!permitido) {
      return;
    }

    setAcaoPostId(postId);
    setMensagem("");

    const token = await obterTokenSessao();

    if (!token) {
      setMensagem("SessÃ£o expirada. Entre novamente para alterar o post.");
      setAcaoPostId("");
      return;
    }

    const resposta = await fetch("/api/blog/posts", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await resposta.json();

    setAcaoPostId("");

    if (!resposta.ok) {
      setMensagem(payload.error ?? "NÃ£o foi possÃ­vel alterar o post.");
      return;
    }

    if (method === "DELETE" && postEmEdicaoId === postId) {
      limparFormulario();
    }

    setMensagem(method === "DELETE" ? "Post excluÃ­do com sucesso." : "Post publicado.");
    await carregarPosts();
  }

  return (
    <DesktopLayout
      titulo="Novo post do blog"
      subtitulo="Criação de conteúdo público do Frentia"
      status={permitido ? "Editor autorizado" : "Acesso restrito"}
      statusTom={permitido ? "andamento" : "planejado"}
    >
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {carregandoAcesso ? (
          <p className="text-sm font-semibold text-slate-500">Verificando acesso...</p>
        ) : !permitido ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {mensagem}
          </div>
        ) : (
          <form onSubmit={salvarPost} className="grid gap-4">
            {mensagem && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
                {mensagem}
              </div>
            )}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Título</span>
              <input
                value={titulo}
                onChange={(event) => {
                  setTitulo(event.target.value);
                  setSlug(criarSlugBlog(event.target.value));
                }}
                className="rounded-xl border border-slate-200 p-3 text-sm"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(criarSlugBlog(event.target.value))}
                className="rounded-xl border border-slate-200 p-3 text-sm"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Resumo</span>
              <textarea
                value={resumo}
                onChange={(event) => setResumo(event.target.value)}
                rows={3}
                className="rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Conteúdo</span>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <button
                  type="button"
                  onClick={() => aplicarFormato("**", "**", "texto em negrito")}
                  className="h-9 min-w-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                  title="Negrito"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => aplicarFormato("<u>", "</u>", "texto sublinhado")}
                  className="h-9 min-w-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 underline transition hover:bg-slate-100"
                  title="Sublinhado"
                >
                  U
                </button>
                <button
                  type="button"
                  onClick={() => aplicarFormato("## ", "", "SubtÃ­tulo")}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                  title="SubtÃ­tulo"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={aplicarBulletPoint}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                  title="Lista com bullet"
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={inserirImagem}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                  title="Imagem por URL"
                >
                  IMG
                </button>
                {[
                  ["#0b2f63", "Azul Frentia"],
                  ["#ff6600", "Laranja Frentia"],
                  ["#168a5b", "Verde"],
                  ["#b42318", "Vermelho"],
                ].map(([cor, nome]) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() =>
                      aplicarFormato(
                        `<span style="color:${cor}">`,
                        "</span>",
                        "texto colorido"
                      )
                    }
                    className="h-9 w-9 rounded-full border border-slate-200 shadow-sm transition hover:scale-105"
                    style={{ backgroundColor: cor }}
                    title={nome}
                    aria-label={nome}
                  />
                ))}
              </div>
              <textarea
                ref={conteudoRef}
                value={conteudo}
                onChange={(event) => setConteudo(event.target.value)}
                rows={12}
                className="rounded-xl border border-slate-200 p-3 text-sm"
                required
              />
            </label>

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
            >
              {salvando
                ? "Salvando..."
                : postEmEdicaoId
                  ? "Atualizar post"
                  : "Salvar post"}
            </button>

            {postEmEdicaoId && (
              <button
                type="button"
                onClick={limparFormulario}
                className="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 md:w-auto"
              >
                Cancelar ediÃ§Ã£o
              </button>
            )}
          </form>
        )}
      </section>

      {permitido && (
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Posts criados</h3>
              <p className="text-sm text-slate-500">
                Lista dos posts salvos por luismattos@gmail.com.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void carregarPosts()}
              disabled={carregandoPosts}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregandoPosts ? "Atualizando..." : "Atualizar lista"}
            </button>
          </div>

          {carregandoPosts && posts.length === 0 ? (
            <EstadoLista texto="Carregando posts..." />
          ) : posts.length === 0 ? (
            <EstadoLista texto="Nenhum post criado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Título</th>
                    <th className="p-3">Slug</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Atualizado</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-t border-slate-100">
                      <td className="p-3 font-bold text-slate-900">{post.title}</td>
                      <td className="p-3 text-slate-600">{post.slug}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            post.status === "published"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {post.status === "published" ? "Publicado" : "Rascunho"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(post.updated_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editarPost(post)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void publicarPost(post)}
                            disabled={acaoPostId === post.id || post.status === "published"}
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Publicar
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluirPost(post)}
                            disabled={acaoPostId === post.id}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </DesktopLayout>
  );
}

function EstadoLista({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-500">
      {texto}
    </p>
  );
}
