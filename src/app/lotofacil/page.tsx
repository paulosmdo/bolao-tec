"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * A lógica da Lotofácil agora vive na raiz (/). Redirect no cliente para
 * manter bookmarks antigos funcionando também no export estático (APK),
 * onde redirect() de servidor não existe.
 */
export default function LotofacilRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
