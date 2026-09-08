import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.paulosmdo.lotofacil",
  appName: "Lotofácil",
  webDir: "out",
  plugins: {
    /**
     * Roteia window.fetch pela camada HTTP nativa do Android — sem CORS.
     * É o que permite ao APK chamar api.guidi.dev.br direto, sem o proxy Next.
     */
    CapacitorHttp: { enabled: true },
  },
};

export default config;
