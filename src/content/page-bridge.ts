import type { RpcOp, RpcResponse } from '../page-world/protocol';

let nextId = 0;
const pending = new Map<number, (msg: RpcResponse) => void>();

window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window) return;
  const data = e.data as Partial<RpcResponse> | undefined;
  if (!data || data.bvc !== 'response' || typeof data.id !== 'number') return;
  pending.get(data.id)?.(data as RpcResponse);
});

export interface RpcOptions {
  timeoutMs?: number;
}

export function rpc<T = unknown>(op: RpcOp, args: Record<string, unknown>, opts: RpcOptions = {}): Promise<T> {
  const id = ++nextId;
  const timeoutMs = opts.timeoutMs ?? 2_000;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`rpc(${op}) timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, msg => {
      clearTimeout(timer);
      pending.delete(id);
      if (msg.ok) resolve(msg.result as T);
      else reject(new Error(msg.error ?? 'rpc failed'));
    });
    window.postMessage({ bvc: 'request', id, op, args }, '*');
  });
}

export function __TEST_resetCounter(): void {
  nextId = 0;
  pending.clear();
}
