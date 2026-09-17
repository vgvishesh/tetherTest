import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Lets Mongoose close its sockets cleanly on SIGTERM.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<AppConfig, true>);
  await app.listen(config.get('port', { infer: true }));
}
void bootstrap();
