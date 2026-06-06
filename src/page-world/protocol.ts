export type RpcOp = 'has-ng' | 'get-component-name' | 'get-signal' | 'set-signal' | 'apply-changes';

export interface RpcRequest {
  bvc: 'request';
  id: number;
  op: RpcOp;
  args: Record<string, unknown>;
}

export interface RpcResponse<T = unknown> {
  bvc: 'response';
  id: number;
  ok: boolean;
  result?: T;
  error?: string;
}
