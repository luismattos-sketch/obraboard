import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SimpleFooter, SimpleHeader } from "../seo-page-content";
import type { BlogPost } from "../../lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Frentia",
  description:
    "Conteúdos sobre controle de execução em campo, planejado x realizado, RDO digital, restrições e turnos em obras.",
  alternates: { canonical: "https://www.frentia.com.br/blog" },
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

async function listarPosts() {
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (data ?? []) as BlogPost[];
}

export default async function BlogPage() {
  const posts = await listarPosts();

  return (
    <main className="marketing-page">
      <SimpleHeader />
      <section className="institutional-hero institutional-hero-simple">
        <div>
          <p className="marketing-eyebrow">Blog Frentia</p>
          <h1>Conteúdos para controlar melhor a execução em campo</h1>
          <p>
            Ideias práticas sobre turnos, restrições, planejado x realizado, RDO digital e
            acompanhamento de frentes em obras e paradas industriais.
          </p>
        </div>
      </section>

      <section className="institutional-section">
        {posts.length === 0 ? (
          <div className="institutional-card">
            <h2>Nenhum post publicado ainda</h2>
            <p>Os primeiros conteúdos do Frentia aparecerão aqui em breve.</p>
          </div>
        ) : (
          <div className="institutional-grid">
            {posts.map((post) => (
              <article className="institutional-card" key={post.id}>
                <p className="marketing-eyebrow">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("pt-BR")
                    : "Blog"}
                </p>
                <h2>{post.title}</h2>
                <p>{post.excerpt || post.content.slice(0, 150)}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="marketing-button marketing-button-secondary"
                  style={{ marginTop: "1rem" }}
                >
                  Ler post
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <SimpleFooter />
    </main>
  );
}
