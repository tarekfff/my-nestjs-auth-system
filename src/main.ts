import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformInterceptor } from './utils/transform.interceptor';
import { ValidationPipe } from '@nestjs/common';
import { TokenAuthGuard } from './common/guards/token-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaService } from './lib/database/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    app.get(ThrottlerGuard),
    new TokenAuthGuard(reflector),
    new MustChangePasswordGuard(reflector, app.get(PrismaService)),
  );

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ompleo Auth API')
    .setDescription(
      'Two-population JWT auth: CompanyUser + StaffUser, refresh rotation, lockout, activation, password reset.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
