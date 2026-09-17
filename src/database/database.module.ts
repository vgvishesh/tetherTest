import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { AppConfig } from '../config/configuration';

const logger = new Logger('Database');

/**
 * Owns the single Mongoose connection for the app.
 *
 * Feature modules never import MongooseModule.forRoot(); they import
 * `MongooseModule.forFeature([...])` and get this connection injected.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('database', { infer: true });

        return {
          uri: db.uri,
          dbName: db.dbName,
          maxPoolSize: db.maxPoolSize,
          serverSelectionTimeoutMS: db.serverSelectionTimeoutMS,
          autoIndex: db.autoIndex,
          retryWrites: true,
          connectionFactory: (connection: Connection) => {
            connection.on('connected', () =>
              logger.log(`Connected to ${connection.name}`),
            );
            connection.on('disconnected', () => logger.warn('Disconnected'));
            connection.on('reconnected', () => logger.log('Reconnected'));
            connection.on('error', (err: Error) =>
              logger.error(`Connection error: ${err.message}`),
            );
            return connection;
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
