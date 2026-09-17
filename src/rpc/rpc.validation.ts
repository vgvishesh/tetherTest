import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

/** RPC payloads bypass ValidationPipe, so each handler validates its own DTO. */
export function parseRpcPayload<T extends object>(
  cls: ClassConstructor<T>,
  payload: unknown,
): T {
  const dto = plainToInstance(cls, payload ?? {}, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid RPC payload: ${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }

  return dto;
}
