import fastifyCsrf from '@fastify/csrf-protection';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // Accept text/csv as a valid content type and pass the raw stream through
  const fastify = app.getHttpAdapter().getInstance();
  // Correlation-ID propagation
  fastify.addHook('onRequest', (req: any, reply: any, done: any) => {
    const incoming = req.headers['x-correlation-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : req.id;
    reply.header('X-Correlation-Id', id);
    done();
  });
  fastify.addContentTypeParser('text/csv', function (_req, payload, done) {
    done(null, payload);
  });

  app.enableCors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.register(helmet);
  await app.register(compress, { threshold: 10240 });
  await app.register(fastifyCsrf);

  // Serialization: apply @Exclude/@Expose on entities
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger OpenAPI at /doc
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Red Atlas API')
    .setDescription('Real estate management API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.API_PORT ?? 3000, '0.0.0.0');
}
bootstrap();
