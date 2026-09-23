import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (
        /localhost|127\.0\.0\.1|skill4handel\.com|skill4handel-api\.onrender\.com/.test(
          origin,
        )
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
