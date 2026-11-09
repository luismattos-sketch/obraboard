import type { Metadata } from "next";
import Script from "next/script";
import AnalyticsEvents from "../components/AnalyticsEvents";
import AuthGuard from "../components/AuthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frentia",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  description: "Gestão de frentes, turnos e campo em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <AnalyticsEvents />
        <AuthGuard>{children}</AuthGuard>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src="https://px.ads.linkedin.com/collect/?pid=10480713&fmt=gif"
          />
        </noscript>
      </body>
      <Script
        id="google-ads-gtag-js"
        src="https://www.googletagmanager.com/gtag/js?id=AW-808377941"
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-808377941');
        `}
      </Script>
      <Script
        id="google-analytics-gtag-js"
        src="https://www.googletagmanager.com/gtag/js?id=G-4HZ3CR5RT6"
        strategy="afterInteractive"
      />
      <Script id="google-analytics-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4HZ3CR5RT6');
        `}
      </Script>
      <Script id="linkedin-insight-init" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "10480713";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        `}
      </Script>
      <Script id="linkedin-insight-tag" strategy="afterInteractive">
        {`
          (function(l) {
            if (!l) {
              window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
              window.lintrk.q = [];
            }
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";
            b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}
      </Script>
    </html>
  );
}
