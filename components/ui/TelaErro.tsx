/** Erro inesperado (ex.: falha momentânea servidor → banco): mensagem em português e "Tentar de novo". */
export function TelaErro({ tentar }: { tentar: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-titulo font-semibold text-primaria">Algo deu errado</h1>
      <p className="text-texto">
        Não foi possível carregar esta tela agora. Costuma ser uma falha momentânea — o que já foi salvo continua salvo.
      </p>
      <button
        type="button"
        onClick={tentar}
        className="min-h-14 rounded-botao bg-primaria px-4 text-lg font-semibold text-white hover:opacity-90"
      >
        Tentar de novo
      </button>
    </main>
  );
}
