import { Module } from '@nestjs/common';
import { RpcServer } from './rpc.server';

@Module({
  providers: [RpcServer],
  exports: [RpcServer],
})
export class RpcModule {}
