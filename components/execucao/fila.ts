/**
 * Fila de execução em série: cada tarefa só começa depois que a anterior terminou (com sucesso ou
 * falha). Usada no efetivo para ler o `esperado` só após o salvamento anterior ter sido gravado.
 */
export function criarFila() {
  let ultima: Promise<unknown> = Promise.resolve();
  return function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const p = ultima.catch(() => {}).then(tarefa);
    ultima = p;
    return p;
  };
}
