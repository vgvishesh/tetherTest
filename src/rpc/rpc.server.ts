import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import HyperswarmRpc, { HyperswarmRpcServer } from '@hyperswarm/rpc';
import type { AppConfig } from '../config/configuration';

export type RpcMethodHandler = (payload: unknown) => Promise<unknown>;

@Injectable()
export class RpcServer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RpcServer.name);
  private readonly handlers = new Map<string, RpcMethodHandler>();
  private rpc?: HyperswarmRpc;
  private server?: HyperswarmRpcServer;

  constructor(private readonly config: ConfigService<AppConfig, true>) { }

  respond(method: string, handler: RpcMethodHandler): void {
    this.handlers.set(method, handler);
    this.server?.respond(method, (request) => this.invoke(method, request));
    this.logger.log(`Registered RPC method ${method}`);
  }

  get publicKey(): string | undefined {
    return this.server?.publicKey.toString('hex');
  }

  async onApplicationBootstrap(): Promise<void> {
    const { enabled, bootstrap } = this.config.get('rpc', {
      infer: true,
    });

    if (!enabled) {
      this.logger.log('RPC server disabled (RPC_ENABLED)');
      return;
    }

    this.rpc = new HyperswarmRpc({ bootstrap });
    this.server = this.rpc.createServer();

    for (const method of this.handlers.keys()) {
      this.server.respond(method, (request) => this.invoke(method, request));
    }

    await this.server.listen();
    this.logger.log(`RPC server listening on ${this.publicKey}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.rpc?.destroy({ force: true });
    this.rpc = undefined;
    this.server = undefined;
  }

  private async invoke(method: string, request: Buffer): Promise<Buffer> {
    const handler = this.handlers.get(method)!;

    try {
      const payload: unknown =
        request.length > 0 ? JSON.parse(request.toString('utf8')) : {};
      const result = await handler(payload);
      return Buffer.from(JSON.stringify(result ?? null), 'utf8');
    } catch (error) {
      this.logger.error(`RPC ${method} failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
