import type { NextConfig } from "next";

// Fotos dos produtos vêm do storage público (Supabase hoje; ao trocar para o MinIO, incluir o host dele aqui).
const storage = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: storage
      ? [{ protocol: storage.protocol === "http:" ? "http" : "https", hostname: storage.hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  transpilePackages: ["@catalogo/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
