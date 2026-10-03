/* Manifesto do app: nome e ícone quando o portal é adicionado à tela inicial do celular. */
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal B&M Log",
    short_name: "B&M Log",
    description: "Solicitações, valores e entregas da B&M Log com a Propaga.",
    start_url: "/inicio/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#003C57",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
