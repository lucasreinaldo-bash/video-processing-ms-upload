import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private readonly videoBucket: string;
  private readonly thumbnailsBucket: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT'),
      port: parseInt(this.configService.get('MINIO_PORT')),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get('MINIO_SECRET_KEY'),
    });

    this.videoBucket = this.configService.get('MINIO_BUCKET_VIDEOS');
    this.thumbnailsBucket = this.configService.get('MINIO_BUCKET_THUMBNAILS');
  }

  async onModuleInit() {
    await this.ensureBucketsExist();
  }

  private async ensureBucketsExist() {
    const buckets = [this.videoBucket, this.thumbnailsBucket];

    for (const bucket of buckets) {
      const exists = await this.minioClient.bucketExists(bucket);
      if (!exists) {
        await this.minioClient.makeBucket(bucket, 'us-east-1');
        this.logger.log(`Bucket '${bucket}' created`);
      } else {
        this.logger.log(`Bucket '${bucket}' already exists`);
      }
    }
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    metadata?: Record<string, string>,
  ): Promise<Minio.UploadedObjectInfo> {
    return this.minioClient.putObject(bucket, objectName, buffer, buffer.length, metadata);
  }

  async uploadVideo(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<Minio.UploadedObjectInfo> {
    return this.uploadFile(this.videoBucket, objectName, buffer, {
      'Content-Type': contentType,
    });
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    await this.minioClient.removeObject(bucket, objectName);
  }

  async deleteVideo(objectName: string): Promise<void> {
    await this.deleteFile(this.videoBucket, objectName);
  }

  async getFileUrl(bucket: string, objectName: string, expiry = 7 * 24 * 60 * 60): Promise<string> {
    return this.minioClient.presignedGetObject(bucket, objectName, expiry);
  }

  async getVideoUrl(objectName: string): Promise<string> {
    return this.getFileUrl(this.videoBucket, objectName);
  }

  getClient(): Minio.Client {
    return this.minioClient;
  }
}
