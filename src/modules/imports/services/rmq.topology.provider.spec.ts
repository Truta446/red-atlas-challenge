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
