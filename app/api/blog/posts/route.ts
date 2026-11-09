import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { criarSlugBlog, usuarioPodeEditarBlog, type BlogPost } from "../../../../lib/blog";
import { criarServiceClient } from "../../../../lib/server-supabase";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

type BlogEditorContext = {
  user: User;
  service: SupabaseClient;
};

async function autenticarEditorBlog(
  request: Request
): Promise<BlogEditorContext | Response> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return Response.json({ error: "Sessão não informada." }, { status: 401 });
  }

  const auth = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: userData, error: userError } = await auth.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  }

  if (!usuarioPodeEditarBlog(userData.user.email)) {
    return Response.json({ error: "Acesso negado." }, { status: 403 });
  }

  const service = criarServiceClient();

  if (!service) {
    return Response.json(
      { error: "Servidor sem chave de publicação do blog." },
      { status: 503 }
    );
  }

  return { user: userData.user, service };
}

export async function GET(request: Request) {
  const contexto = await autenticarEditorBlog(request);

  if (contexto instanceof Response) {
    return contexto;
  }

  const { data, error } = await contexto.service
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  const contexto = await autenticarEditorBlog(request);

  if (contexto instanceof Response) {
    return contexto;
  }

  const body = (await request.json()) as Partial<BlogPost>;
  const title = String(body.title ?? "").trim();
  const excerpt = String(body.excerpt ?? "").trim();
  const content = String(body.content ?? "").trim();
  const status = body.status === "published" ? "published" : "draft";

  if (!title || !content) {
    return Response.json(
      { error: "Informe título e conteúdo do post." },
      { status: 400 }
    );
  }

  const slugBase = criarSlugBlog(String(body.slug ?? "") || title);
  const slug = slugBase || `post-${Date.now()}`;

  const { data, error } = await contexto.service
    .from("blog_posts")
    .insert({
      title,
      slug,
      excerpt,
      content,
      status,
      author_email: contexto.user.email,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ post: data });
}

export async function PATCH(request: Request) {
  const contexto = await autenticarEditorBlog(request);

  if (contexto instanceof Response) {
    return contexto;
  }

  const body = (await request.json()) as Partial<BlogPost> & {
    id?: string;
    action?: string;
  };
  const id = String(body.id ?? "").trim();

  if (!id) {
    return Response.json({ error: "Post nÃ£o informado." }, { status: 400 });
  }

  const status = body.status === "published" ? "published" : "draft";
  const updates: Partial<BlogPost> = {
    status,
    published_at:
      status === "published"
        ? body.published_at ?? new Date().toISOString()
        : null,
  };

  if (body.action !== "publish") {
    const title = String(body.title ?? "").trim();
    const excerpt = String(body.excerpt ?? "").trim();
    const content = String(body.content ?? "").trim();

    if (!title || !content) {
      return Response.json(
        { error: "Informe tÃ­tulo e conteÃºdo do post." },
        { status: 400 }
      );
    }

    const slugBase = criarSlugBlog(String(body.slug ?? "") || title);
    updates.title = title;
    updates.slug = slugBase || `post-${Date.now()}`;
    updates.excerpt = excerpt;
    updates.content = content;
  }

  const { data, error } = await contexto.service
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ post: data });
}

export async function DELETE(request: Request) {
  const contexto = await autenticarEditorBlog(request);

  if (contexto instanceof Response) {
    return contexto;
  }

  const body = (await request.json()) as { id?: string };
  const id = String(body.id ?? "").trim();

  if (!id) {
    return Response.json({ error: "Post nÃ£o informado." }, { status: 400 });
  }

  const { error } = await contexto.service.from("blog_posts").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
