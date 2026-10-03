import type { NextConfig } from "next";

/* Exportação estática para o Firebase Hosting (plano Spark, sem servidor).
   Cabeçalhos de segurança ficam em firebase.json. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
