import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@react-pdf/renderer"],
  // O logo do RDO é lido do disco em runtime; sem isto o trace da Vercel não o inclui.
  outputFileTracingIncludes: { "/api/rdo/*": ["./public/frentia-logo.png"] },
};

export default nextConfig;
