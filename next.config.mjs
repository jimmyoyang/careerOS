import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf"],
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  outputFileTracingIncludes: { "/*": ["./node_modules/pdfjs-dist/cmaps/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/api/career/materials/:id/download",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
