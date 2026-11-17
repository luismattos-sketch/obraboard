import { dimensoesReduzidas, FOTO_QUALIDADE } from "@/lib/dominio/foto";

/** No aparelho: redesenha a foto no canvas (lado maior ≤ 1280 px) e devolve JPEG ~0,7. Só no navegador. */
export async function reduzirFoto(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const { largura, altura } = dimensoesReduzidas(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(img, 0, 0, largura, altura);
  img.close();
  return new Promise<Blob>((pronto, falhou) =>
    canvas.toBlob((b) => (b ? pronto(b) : falhou(new Error("não foi possível reduzir a foto"))), "image/jpeg", FOTO_QUALIDADE),
  );
}
