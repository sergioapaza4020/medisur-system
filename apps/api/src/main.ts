import { NestFactory } from '@nestjs/core';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Medisur API')
    .setDescription(
      'API para el sistema de fichaje e historiales clínicos del Centro Médico de Especialidades "Medisur" de la ciudad de Potosí',
    )
    .setContact('MushuDev', '#', 'sergio.apaza1432@gmail.com')
    .setVersion('0.0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese únicamente el token JWT sin el prefijo "Bearer "',
      },
      'access-token',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    explorer: true,
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-custom-header',
    ],
  });
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3011);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
