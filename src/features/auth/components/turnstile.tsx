"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

// CAPTCHA opcional (Cloudflare Turnstile). Só é exibido se a chave pública existir.
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken: (token: string | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    const timer = setInterval(() => {
      if (!window.turnstile || !ref.current) return;
      clearInterval(timer);
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(undefined),
      });
    }, 200);
    return () => {
      clearInterval(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={ref} id={id} className="min-h-16" />
    </>
  );
}
