import { useEffect, useRef, useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({ onVerify, onError, onExpire, className }: TurnstileWidgetProps) {
  const { settings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isEnabled = settings.turnstile_enabled === true || settings.turnstile_enabled === "true";
  const siteKey = settings.turnstile_site_key?.trim();

  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!isEnabled || !siteKey || !containerRef.current) return;

    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (isMounted) {
              setLoading(false);
              onVerifyRef.current(token);
            }
          },
          "error-callback": () => {
            if (isMounted) {
              setLoading(false);
              if (onErrorRef.current) onErrorRef.current();
            }
          },
          "expired-callback": () => {
            if (isMounted && onExpireRef.current) onExpireRef.current();
          },
          theme: "light",
        });
        // Widget rendered into the container — hide the skeleton.
        setLoading(false);
      } catch (err) {
        console.warn("[TurnstileWidget] render error:", err);
        setLoading(false);
      }
    }

    if (!window.turnstile) {
      const existingScript = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          renderWidget();
        };
        document.head.appendChild(script);
      } else {
        // If script is already in head, check if it's already loaded or poll briefly
        const interval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(interval);
            renderWidget();
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 5000);
      }
    } else {
      renderWidget();
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [isEnabled, siteKey]);

  if (!isEnabled || !siteKey) return null;

  return (
    <div className={`my-3 flex justify-center ${className || ""}`}>
      {loading && (
        <div className="flex items-center gap-2 px-4 w-[300px] h-[65px] rounded-lg border border-gray-200 bg-gray-50">
          <div className="h-3.5 w-3.5 rounded-full bg-gray-300" />
          <span className="text-xs text-gray-400">Memuat verifikasi keamanan…</span>
        </div>
      )}
      <div ref={containerRef} className={loading ? "hidden" : ""} />
    </div>
  );
}
