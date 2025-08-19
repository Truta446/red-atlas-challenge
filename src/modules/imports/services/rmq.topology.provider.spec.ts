import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import amqplib from 'amqplib';
import { ImportsRmqTopology } from './rmq.topology.provider';

jest.mock('amqplib');

describe('ImportsRmqTopology', () => {
  const connect = amqplib.connect as unknown as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('builds URL from host/user/pass when RABBITMQ_URL missing', async () => {
    const assertQueue = jest.fn();
    const closeCh = jest.fn();
    const closeConn = jest.fn();
    connect.mockResolvedValue({
      createChannel: async () => ({ assertQueue, close: closeCh }),
      close: closeConn,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsRmqTopology,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: any) => {
              if (key === 'RABBITMQ_URL') return undefined;
              if (key === 'RABBITMQ_HOST') return 'b-123.mq.amazonaws.com:5671';
              if (key === 'RABBITMQ_USER') return 'admin';
              if (key === 'RABBITMQ_PASSWORD') return 'pass!';
              return def;
            },
          },
        },
      ],
    }).compile();

    const topo = moduleRef.get(ImportsRmqTopology);
    await topo.onModuleInit();

    expect(connect).toHaveBeenCalledWith(expect.stringMatching(/^amqps:\/\//));
    expect(String(connect.mock.calls[0][0])).toContain('admin:');
    expect(String(connect.mock.calls[0][0])).toContain('pass!@');
  });

  it('logs error when connect/assert fails', async () => {
    connect.mockRejectedValue(new Error('boom'));
    const moduleRef = await Test.createTestingModule({
      providers: [ImportsRmqTopology, { provide: ConfigService, useValue: { get: () => 'amqp://localhost' } }],
    }).compile();

    const topo = moduleRef.get(ImportsRmqTopology);
    const spy = jest.spyOn(topo.logger, 'error').mockImplementation(() => undefined);
    await topo.onModuleInit();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to assert RMQ topology'));
  });

  it('logs error when closing resources fails', async () => {
    const assertQueue = jest.fn();
    const closeCh = jest.fn().mockRejectedValue(new Error('close ch'));
    const closeConn = jest.fn().mockRejectedValue(new Error('close conn'));
    connect.mockResolvedValue({
      createChannel: async () => ({ assertQueue, close: closeCh }),
      close: closeConn,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [ImportsRmqTopology, { provide: ConfigService, useValue: { get: () => 'amqp://local' } }],
    }).compile();

    const topo = moduleRef.get(ImportsRmqTopology);
    const spy = jest.spyOn(topo.logger, 'error').mockImplementation(() => undefined);
    await topo.onModuleInit();
    // At least one close error should be logged
    expect(spy.mock.calls.some((c) => String(c[0]).includes('Failed to close RMQ connection'))).toBe(true);
  });

  it('skips when RABBITMQ_URL is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportsRmqTopology, { provide: ConfigService, useValue: { get: () => undefined } }],
    }).compile();

    const topo = moduleRef.get(ImportsRmqTopology);
    await topo.onModuleInit();

    expect(connect).not.toHaveBeenCalled();
  });

  it('asserts queues and closes channel/connection', async () => {
    const assertQueue = jest.fn();
    const closeCh = jest.fn();
    const closeConn = jest.fn();
    connect.mockResolvedValue({
      createChannel: async () => ({ assertQueue, close: closeCh }),
      close: closeConn,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [ImportsRmqTopology, { provide: ConfigService, useValue: { get: () => 'amqp://localhost' } }],
    }).compile();

    const topo = moduleRef.get(ImportsRmqTopology);
    await topo.onModuleInit();

    expect(assertQueue).toHaveBeenCalledTimes(4);
    expect(closeCh).toHaveBeenCalled();
    expect(closeConn).toHaveBeenCalled();
  });
});
