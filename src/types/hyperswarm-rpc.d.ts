declare module '@hyperswarm/rpc' {
  export type RpcRequestHandler = (request: Buffer) => Buffer | Promise<Buffer>;

  export interface HyperswarmRpcServer {
    readonly publicKey: Buffer;
    listen(): Promise<void>;
    respond(method: string, handler: RpcRequestHandler): void;
    close(): Promise<void>;
  }

  export interface HyperswarmRpcOptions {
    seed?: Buffer;
    bootstrap?: string[];
  }

  export default class HyperswarmRpc {
    constructor(options?: HyperswarmRpcOptions);
    createServer(): HyperswarmRpcServer;
    request(publicKey: Buffer, method: string, value: Buffer): Promise<Buffer>;
    destroy(options?: { force?: boolean }): Promise<void>;
  }
}
