import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Video } from '@prisma/client';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('video')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload de vídeo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Vídeo enviado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Arquivo inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Video> {
    return this.uploadService.uploadVideo(user.userId, file);
  }

  @Get('videos')
  @ApiOperation({ summary: 'Listar vídeos do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Lista de vídeos',
  })
  async getUserVideos(@CurrentUser() user: any): Promise<Video[]> {
    return this.uploadService.getUserVideos(user.userId);
  }

  @Get('videos/:id')
  @ApiOperation({ summary: 'Buscar vídeo por ID' })
  @ApiResponse({
    status: 200,
    description: 'Vídeo encontrado',
  })
  @ApiResponse({ status: 404, description: 'Vídeo não encontrado' })
  async getVideoById(
    @Param('id') videoId: string,
    @CurrentUser() user: any,
  ): Promise<Video> {
    return this.uploadService.getVideoById(videoId, user.userId);
  }

  @Get('videos/:id/url')
  @ApiOperation({ summary: 'Obter URL de download do vídeo' })
  @ApiResponse({
    status: 200,
    description: 'URL do vídeo',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  async getVideoUrl(
    @Param('id') videoId: string,
    @CurrentUser() user: any,
  ): Promise<{ url: string }> {
    const url = await this.uploadService.getVideoUrl(videoId, user.userId);
    return { url };
  }

  @Delete('videos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar vídeo' })
  @ApiResponse({ status: 204, description: 'Vídeo deletado com sucesso' })
  @ApiResponse({ status: 404, description: 'Vídeo não encontrado' })
  async deleteVideo(
    @Param('id') videoId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.uploadService.deleteVideo(videoId, user.userId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check do serviço de upload' })
  @ApiResponse({ status: 200, description: 'Serviço funcionando' })
  health() {
    return { status: 'ok', service: 'ms-upload' };
  }
}
