export const BLOG_AUTHOR_EMAIL = "luismattos@gmail.com";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  status: "draft" | "published";
  author_email: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function usuarioPodeEditarBlog(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase() === BLOG_AUTHOR_EMAIL;
}

export function criarSlugBlog(titulo: string) {
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
