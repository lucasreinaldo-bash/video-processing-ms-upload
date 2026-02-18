import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MinioService } from '../minio/minio.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Video, VideoStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private prisma: PrismaService,
    private minioService: MinioService,
    private rabbitmqService: RabbitmqService,
    private configService: ConfigService,
  ) {
    this.maxFileSize = parseInt(this.configService.get('MAX_FILE_SIZE') || '524288000');
    this.allowedMimeTypes = this.configService.get('ALLOWED_MIME_TYPES')?.split(',') || [];
  }

  async uploadVideo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<Video> {
    // Validações
    this.validateFile(file);

    // Gerar chave única para storage
    const ext = file.originalname.split('.').pop();
    const storageKey = `${uuidv4()}.${ext}`;

    try {
      // 1. Upload para MinIO
      this.logger.log(`Uploading video to MinIO: ${storageKey}`);
      await this.minioService.uploadVideo(storageKey, file.buffer, file.mimetype);

      // 2. Salvar metadados no banco
      const video = await this.prisma.video.create({
        data: {
          userId,
          filename: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          size: BigInt(file.size),
          status: VideoStatus.PENDING,
        },
      });

      // 3. Publicar mensagem no RabbitMQ para processamento
      await this.rabbitmqService.publishVideoProcessing({
        videoId: video.id,
        storageKey: video.storageKey,
        userId: video.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Video uploaded successfully: ${video.id}`);
      return video;
    } catch (error) {
      this.logger.error('Error uploading video', error);
      // Se falhou após upload no MinIO, tentar limpar
      try {
        await this.minioService.deleteVideo(storageKey);
      } catch (cleanupError) {
        this.logger.error('Error cleaning up MinIO file', cleanupError);
      }
      throw error;
    }
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    return this.prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVideoById(videoId: string, userId: string): Promise<Video> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.userId !== userId) {
      throw new BadRequestException('Unauthorized access to video');
    }

    return video;
  }

  async deleteVideo(videoId: string, userId: string): Promise<void> {
    const video = await this.getVideoById(videoId, userId);

    // Deletar do MinIO
    try {
      await this.minioService.deleteVideo(video.storageKey);
    } catch (error) {
      this.logger.error('Error deleting video from MinIO', error);
    }

    // Deletar do banco
    await this.prisma.video.delete({
      where: { id: videoId },
    });

    this.logger.log(`Video deleted: ${videoId}`);
  }

  async getVideoUrl(videoId: string, userId: string): Promise<string> {
    const video = await this.getVideoById(videoId, userId);
    return this.minioService.getVideoUrl(video.storageKey);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${this.maxFileSize / 1024 / 1024}MB)`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }
}
