import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@react-pdf/renderer"],
  // O logo do RDO é lido do disco em runtime; sem isto o trace da Vercel não o inclui.
  outputFileTracingIncludes: { "/api/rdo/*": ["./public/frentia-logo-pdf.png"] },
  async headers() {
    return [
      {
        // Todas as rotas: sem iframe (clickjacking) e Referer só com a origem para outros sites.
        // A página /t/ (link secreto) mantém o <meta name="referrer" content="no-referrer">.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Reforço do meta da página do encarregado: o token na URL nunca vai no Referer.
        source: "/t/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
