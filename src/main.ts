import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import * as dotenv from 'dotenv';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import passport = require('passport');
// eslint-disable-next-line @typescript-eslint/no-require-imports
import session = require('express-session');

dotenv.config({ path: '.env.local' });
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'https://excel-pro-next-git-develop-eloras-dev.vercel.app',
    'https://excel-pro-next.vercel.app',
    'http://localhost:3000',
    'https://excelproso.com',
    'https://www.excelproso.com',
  ];
  //
  app.enableCors({
    origin: (origin, callback) => {
      console.log(`Origin trying to access: ${origin}`);
      console.log(`Allowed origins: ${allowedOrigins}`);
      if (!origin || allowedOrigins.includes(origin)) {
        console.log(`Access granted for origin: ${origin}`);
        callback(null, true);
      } else {
        console.log(`Access denied for origin: ${origin}`);
        callback(new Error(`CORS error: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Access-Control-Allow-Methods',
      'Access-Control-Request-Headers',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  app.use(
    session({
      secret: 'secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production' },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

  const config = new DocumentBuilder()
    .setTitle('Excel Pro Nest App')
    .setDescription(
      'A comprehensive NestJS application built for managing operations and workflows of Excel Pro Football Academy.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
