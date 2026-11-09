"use client";

import DesktopLayout from "../../components/DesktopLayout";
import SuporteChat from "../../components/SuporteChat";

export default function SuportePage() {
  return (
    <DesktopLayout
      titulo="Suporte Frentia"
      subtitulo="Fale direto com o suporte do Frentia"
    >
      <SuporteChat />
    </DesktopLayout>
  );
}
