/** @type {import('next').NextConfig} */
const nextConfig = {
  // BUILD_TARGET=mobile gera export estático (out/) para o APK via Capacitor.
  // O build normal (Vercel) continua com servidor + rota de proxy da API.
  ...(process.env.BUILD_TARGET === "mobile"
    ? { output: "export", images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
