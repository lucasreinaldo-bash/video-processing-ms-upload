import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { MinioModule } from './minio/minio.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MinioModule,
    RabbitmqModule,
    AuthModule,
    UploadModule,
  ],
})
export class AppModule {}
