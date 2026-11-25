import path from "node:path";
import { register } from "tsconfig-paths";

register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { SafeExceptionFilter } from "../src/common/http-exception.filter";

let cachedServer: Express | null = null;

async function getServer(): Promise<Express> {
  if (cachedServer) return cachedServer;

  const { AppModule } = await import("../src/app.module");
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { rawBody: true });

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

  await app.init();
  cachedServer = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const server = await getServer();
  server(req, res);
}
