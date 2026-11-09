"use client";

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const LINKEDIN_SIGNUP_CONVERSION_ID = 29390633;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    lintrk?: (eventName: "track", params: { conversion_id: number }) => void;
    __frentiaLinkedinConversions?: Set<number>;
  }
}

export function obterParametrosUtm() {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);

  return UTM_KEYS.reduce<Record<string, string>>((resultado, chave) => {
    const valor = params.get(chave);

    if (valor) {
      resultado[chave] = valor;
    }

    return resultado;
  }, {});
}

export function anexarUtmEmUrl(href: string) {
  if (typeof window === "undefined") {
    return href;
  }

  const utms = obterParametrosUtm();

  if (Object.keys(utms).length === 0) {
    return href;
  }

  const url = new URL(href, window.location.origin);

  if (url.origin !== window.location.origin) {
    return href;
  }

  for (const [chave, valor] of Object.entries(utms)) {
    if (!url.searchParams.has(chave)) {
      url.searchParams.set(chave, valor);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function dispararEventoAnalytics(
  nomeEvento: string,
  parametros: AnalyticsParams = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  const gtag = obterGtag();

  gtag("event", nomeEvento, limparParametros({
    ...parametros,
    ...obterParametrosUtm(),
  }));
}

export function dispararPageView() {
  if (typeof window === "undefined") {
    return;
  }

  const gtag = obterGtag();
  const pagePath = `${window.location.pathname}${window.location.search}`;

  gtag("event", "page_view", limparParametros({
    page_path: pagePath,
    page_location: window.location.href,
    ...obterParametrosUtm(),
  }));
}

export function dispararCtaClick(buttonText: string) {
  dispararEventoAnalytics("cta_click", {
    button_text: buttonText,
    page_path: window.location.pathname,
    source_url: window.location.href,
  });
}

export function dispararSignupStart() {
  dispararEventoAnalytics("signup_start", {
    page_path: window.location.pathname,
  });
}

export function dispararSignupSubmit(funcao?: string | null) {
  dispararEventoAnalytics("signup_submit", {
    page_path: window.location.pathname,
    user_role: funcao?.trim() || undefined,
  });
  dispararConversaoLinkedinSignup();
}

export function dispararSignupComplete(userId?: string | null) {
  dispararEventoAnalytics("signup_complete", {
    user_id: userId || undefined,
    page_path: window.location.pathname,
  });
}

function limparParametros(parametros: AnalyticsParams) {
  return Object.fromEntries(
    Object.entries(parametros).filter(([, valor]) => valor !== undefined)
  );
}

function obterGtag() {
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }

  return window.gtag;
}

function dispararConversaoLinkedinSignup() {
  if (
    typeof window === "undefined" ||
    typeof window.lintrk !== "function"
  ) {
    return;
  }

  window.__frentiaLinkedinConversions =
    window.__frentiaLinkedinConversions ?? new Set<number>();

  if (window.__frentiaLinkedinConversions.has(LINKEDIN_SIGNUP_CONVERSION_ID)) {
    return;
  }

  window.__frentiaLinkedinConversions.add(LINKEDIN_SIGNUP_CONVERSION_ID);
  window.lintrk("track", { conversion_id: LINKEDIN_SIGNUP_CONVERSION_ID });
}
