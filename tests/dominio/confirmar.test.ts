import { describe, expect, it } from "vitest";
import { destinoConfirmacao } from "@/lib/dominio/confirmar";

describe("destinoConfirmacao", () => {
  it("code ok: vai para o proximo seguro", () => {
    expect(destinoConfirmacao({ code: "c", proximo: "/obras/1" }, "ok")).toBe("/obras/1");
  });
  it("code ok sem proximo: /obras", () => {
    expect(destinoConfirmacao({ code: "c" }, "ok")).toBe("/obras");
  });
  it("code falhou em cadastro: aviso de e-mail confirmado", () => {
    expect(destinoConfirmacao({ code: "c" }, "falhou")).toBe("/login?aviso=email-confirmado");
  });
  it("code falhou em recuperação: link expirado", () => {
    expect(destinoConfirmacao({ code: "c", proximo: "/redefinir-senha" }, "falhou")).toBe(
      "/login?erro=link-expirado",
    );
  });
  it("error_code otp_expired: link expirado", () => {
    expect(destinoConfirmacao({ error: "access_denied", error_code: "otp_expired" }, null)).toBe(
      "/login?erro=link-expirado",
    );
  });
  it("error em cadastro: aviso de e-mail confirmado", () => {
    expect(destinoConfirmacao({ error: "server_error" }, null)).toBe("/login?aviso=email-confirmado");
  });
  it("error em recuperação: link expirado", () => {
    expect(destinoConfirmacao({ error: "x", proximo: "/redefinir-senha" }, null)).toBe(
      "/login?erro=link-expirado",
    );
  });
  it("token_hash falhou: link expirado", () => {
    expect(destinoConfirmacao({ token_hash: "t", type: "email" }, "falhou")).toBe(
      "/login?erro=link-expirado",
    );
  });
  it("nada: link expirado", () => {
    expect(destinoConfirmacao({}, null)).toBe("/login?erro=link-expirado");
  });
  it("proximo malicioso: /obras", () => {
    expect(destinoConfirmacao({ code: "c", proximo: "//evil.com" }, "ok")).toBe("/obras");
  });
});
