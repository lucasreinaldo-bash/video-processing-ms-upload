import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private readonly queueVideoProcessing: string;
  private readonly queueVideoFailed: string;

  constructor(private configService: ConfigService) {
    this.queueVideoProcessing = this.configService.get('RABBITMQ_QUEUE_VIDEO_PROCESSING');
    this.queueVideoFailed = this.configService.get('RABBITMQ_QUEUE_VIDEO_FAILED');
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    const url = this.configService.get('RABBITMQ_URL');
    
    this.connection = amqp.connect([url]);
    
    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {
        await channel.assertQueue(this.queueVideoProcessing, { durable: true });
        await channel.assertQueue(this.queueVideoFailed, { durable: true });
        this.logger.log('RabbitMQ queues asserted');
      },
    });
  }

  async publishVideoProcessing(message: any): Promise<void> {
    try {
      await this.channelWrapper.sendToQueue(this.queueVideoProcessing, message);
      this.logger.log(`Message published to ${this.queueVideoProcessing}: ${JSON.stringify(message)}`);
    } catch (error) {
      this.logger.error('Error publishing message to RabbitMQ', error);
      throw error;
    }
  }

  async publishVideoFailed(message: any): Promise<void> {
    try {
      await this.channelWrapper.sendToQueue(this.queueVideoFailed, message);
      this.logger.log(`Message published to ${this.queueVideoFailed}`);
    } catch (error) {
      this.logger.error('Error publishing failed message', error);
      throw error;
    }
  }

  private async disconnect() {
    await this.channelWrapper.close();
    await this.connection.close();
    this.logger.log('Disconnected from RabbitMQ');
  }
}
