import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { SimpleFooter, SimpleHeader } from "../../seo-page-content";
import type { BlogPost } from "../../../lib/blog";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

async function buscarPost(slug: string) {
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
    .eq("slug", slug)
    .maybeSingle();

  return data as BlogPost | null;
}

function renderizarTextoFormatado(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const regex =
    /(\*\*([^*]+)\*\*)|(<u>(.*?)<\/u>)|(<span style="color:(#[0-9a-fA-F]{6})">(.*?)<\/span>)/g;
  let ultimoIndice = 0;
  let indice = 0;

  for (const match of texto.matchAll(regex)) {
    if (match.index === undefined) {
      continue;
    }

    if (match.index > ultimoIndice) {
      partes.push(texto.slice(ultimoIndice, match.index));
    }

    if (match[2]) {
      partes.push(<strong key={`b-${indice}`}>{match[2]}</strong>);
    } else if (match[4]) {
      partes.push(<u key={`u-${indice}`}>{match[4]}</u>);
    } else if (match[6] && match[7]) {
      partes.push(
        <span key={`c-${indice}`} style={{ color: match[6] }}>
          {match[7]}
        </span>
      );
    }

    ultimoIndice = match.index + match[0].length;
    indice += 1;
  }

  if (ultimoIndice < texto.length) {
    partes.push(texto.slice(ultimoIndice));
  }

  return partes;
}

function obterImagemSegura(texto: string) {
  const match = texto.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);

  if (!match) {
    return null;
  }

  try {
    const url = new URL(match[2]);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return {
      alt: match[1] || "Imagem do post",
      src: url.toString(),
    };
  } catch {
    return null;
  }
}

function renderizarBloco(bloco: string) {
  const texto = bloco.trim();
  const imagem = obterImagemSegura(texto);

  if (imagem) {
    return (
      <figure className="blog-post-image" key={texto}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagem.src} alt={imagem.alt} loading="lazy" />
        {imagem.alt && <figcaption>{imagem.alt}</figcaption>}
      </figure>
    );
  }

  const linhas = texto.split("\n").map((linha) => linha.trim()).filter(Boolean);

  if (linhas.length > 0 && linhas.every((linha) => linha.startsWith("- "))) {
    return (
      <ul key={texto}>
        {linhas.map((linha) => (
          <li key={linha}>{renderizarTextoFormatado(linha.slice(2))}</li>
        ))}
      </ul>
    );
  }

  if (texto.startsWith("## ")) {
    return <h2 key={texto}>{renderizarTextoFormatado(texto.slice(3))}</h2>;
  }

  return <p key={texto}>{renderizarTextoFormatado(texto)}</p>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await buscarPost(slug);

  if (!post) {
    return { title: "Post não encontrado | Frentia" };
  }

  return {
    title: `${post.title} | Frentia`,
    description: post.excerpt || post.content.slice(0, 150),
    alternates: { canonical: `https://www.frentia.com.br/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await buscarPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="marketing-page">
      <SimpleHeader />
      <article className="institutional-legal blog-post-page">
        <section className="institutional-card">
          <p className="marketing-eyebrow">
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString("pt-BR")
              : "Blog"}
          </p>
          <h1>{post.title}</h1>
          {post.excerpt && <p className="blog-post-excerpt">{post.excerpt}</p>}
          <div className="blog-post-content">
            {post.content.split(/\n{2,}/).map((paragraph) => renderizarBloco(paragraph))}
          </div>
        </section>
      </article>
      <SimpleFooter />
    </main>
  );
}
