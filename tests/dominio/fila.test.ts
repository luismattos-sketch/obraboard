import { describe, expect, it } from "vitest";
import { criarFila } from "@/components/execucao/fila";

describe("criarFila", () => {
  it("o segundo salvamento recebe o esperado produzido pelo primeiro", async () => {
    const fila = criarFila();
    let esperado = "v0";
    const recebidos: string[] = [];
    let liberar!: () => void;
    const lento = new Promise<void>((r) => (liberar = r));

    const salvar = (valor: string, espera?: Promise<void>) =>
      fila(async () => {
        recebidos.push(esperado);
        await espera;
        esperado = valor;
        return valor;
      });

    const p1 = salvar("v1", lento); // em voo
    const p2 = salvar("v2"); // disparado antes de p1 terminar
    await new Promise((r) => setTimeout(r, 10));
    expect(recebidos).toEqual(["v0"]); // p1 começou, p2 espera
    liberar();
    expect(await p1).toBe("v1");
    expect(await p2).toBe("v2");
    expect(recebidos).toEqual(["v0", "v1"]);
  });

  it("falha anterior não trava a fila e é repassada a quem chamou", async () => {
    const fila = criarFila();
    const p1 = fila(async () => {
      throw new Error("rede");
    });
    const p2 = fila(async () => "ok");
    await expect(p1).rejects.toThrow("rede");
    expect(await p2).toBe("ok");
  });
});
