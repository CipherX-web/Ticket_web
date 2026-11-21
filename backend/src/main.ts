import path from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { SafeExceptionFilter } from "./common/http-exception.filter";

// Load shared root .env before booting NestJS
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: allowedOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Print X API listening on http://localhost:${port}`);
}

void bootstrap();
