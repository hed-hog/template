/**
 * Baixa um arquivo servido pela API, salvando com o nome original.
 *
 * O atributo `download` de um link não vale para outra origem, e a API mora num
 * domínio diferente do admin: um `<a download href="https://api...">` abre o
 * arquivo numa aba em vez de salvar. Buscar o conteúdo e entregar um blob local
 * é o que faz o navegador tratar como download de verdade.
 *
 * Devolve `false` quando não deu (rede, CORS, 404), para quem chamou avisar.
 */
export async function downloadFile(
  url: string,
  filename: string,
): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;

    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    return true;
  } catch {
    return false;
  }
}
