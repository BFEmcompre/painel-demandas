import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// O FLOW monta varios componentes ao mesmo tempo (RootLayout, Home, menu etc.)
// e todos podem pedir o usuario autenticado no mesmo instante. O Supabase usa
// navigator.locks internamente para proteger o refresh token; chamadas getUser
// concorrentes podem disputar esse mesmo lock, principalmente durante HMR.
//
// Mantemos uma unica requisicao getUser sem JWT em voo e compartilhamos a
// mesma Promise entre todos os consumidores. O estado fica em globalThis para
// sobreviver ao hot reload do Vite durante o desenvolvimento.
type FlowAuthGlobal = typeof globalThis & {
  __flowGetUserPromise?: Promise<any> | null;
};

const flowGlobal = globalThis as FlowAuthGlobal;
const originalGetUser = supabaseClient.auth.getUser.bind(supabaseClient.auth);

function isNavigatorLockError(error: unknown) {
  const name = String((error as { name?: string })?.name || '');
  const message = String((error as { message?: string })?.message || '');

  return (
    name === 'NavigatorLockAcquireTimeoutError' ||
    name === 'AbortError' ||
    message.includes('NavigatorLockAcquireTimeoutError') ||
    message.includes('Lock broken by another request') ||
    message.includes('another request stole it')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserWithSingleRetry(jwt?: string) {
  try {
    return jwt ? await originalGetUser(jwt) : await originalGetUser();
  } catch (error) {
    if (!isNavigatorLockError(error)) throw error;

    // Um HMR/outra aba pode ter roubado o lock no exato momento da chamada.
    // Aguarda a liberacao e tenta uma unica vez novamente, sem loop infinito.
    await sleep(150);
    return jwt ? originalGetUser(jwt) : originalGetUser();
  }
}

supabaseClient.auth.getUser = ((jwt?: string) => {
  // Chamadas com JWT explicito nao compartilham cache porque podem representar
  // tokens diferentes. O FLOW normalmente usa a versao sem argumento.
  if (jwt) return getUserWithSingleRetry(jwt);

  if (flowGlobal.__flowGetUserPromise) {
    return flowGlobal.__flowGetUserPromise;
  }

  const request = getUserWithSingleRetry();
  flowGlobal.__flowGetUserPromise = request;

  const clearRequest = () => {
    if (flowGlobal.__flowGetUserPromise === request) {
      flowGlobal.__flowGetUserPromise = null;
    }
  };

  request.then(clearRequest, clearRequest);
  return request;
}) as typeof supabaseClient.auth.getUser;

// supabase-js transforma qualquer HTTP 4xx/5xx de Edge Function em uma mensagem
// generica ("Edge Function returned a non-2xx status code"). Para o FLOW isso
// atrapalha muito o diagnostico. Quando houver um Response no contexto do erro,
// lemos uma copia do corpo e colocamos a mensagem real no proprio erro.
const originalFunctionsInvoke = supabaseClient.functions.invoke.bind(supabaseClient.functions);

supabaseClient.functions.invoke = (async (...args: Parameters<typeof originalFunctionsInvoke>) => {
  const result = await originalFunctionsInvoke(...args);
  const functionError = result.error as any;
  const response = functionError?.context;

  if (functionError && response instanceof Response) {
    try {
      const clone = response.clone();
      const contentType = clone.headers.get('content-type') || '';
      let detail = '';

      if (contentType.includes('application/json')) {
        const body = await clone.json();
        detail = String(body?.error || body?.message || JSON.stringify(body));
      } else {
        detail = (await clone.text()).trim();
      }

      if (detail) {
        functionError.message = `Edge Function ${response.status}: ${detail}`;
      } else {
        functionError.message = `Edge Function ${response.status}: ${functionError.message}`;
      }
    } catch {
      functionError.message = `Edge Function ${response.status}: ${functionError.message}`;
    }
  }

  return result;
}) as typeof supabaseClient.functions.invoke;

export const supabase = supabaseClient;
