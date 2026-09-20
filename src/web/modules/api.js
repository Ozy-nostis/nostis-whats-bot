/**
 * Wrapper de fetch: devolve o JSON da resposta ou lança um Error com uma
 * mensagem já pronta para o usuário (usada direto nos toasts).
 */
export async function api(path, { method = "GET", body } = {}) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Sem conexão com o bot. Verifique se o programa continua aberto.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Falha na requisição (status ${res.status}).`);
  return data;
}
