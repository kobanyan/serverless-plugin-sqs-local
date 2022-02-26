import Sqs from 'aws-sdk/clients/sqs';
import mergeWith from 'lodash.mergewith';
import * as Serverless from 'serverless';
import * as Service from 'serverless/classes/Service';
import waitOn from 'wait-on';
const Lambda = require('serverless-offline/dist/lambda').default;

import elasticmq from '@serverless-plugin-sqs-local/elasticmq-localhost';
import { Options as ElasticMQOptions } from '@serverless-plugin-sqs-local/elasticmq-localhost/lib/Config';

const PLUGIN_NAME = 'serverless-plugin-sqs-local';

type PluginOptions = Serverless.Options & {
  ElasticMQDownloadUrl?: string;
  ElasticMQPath?: string;
  ElasticMQPort?: number;
  location?: string;
};

interface PluginConfig {
  elasticmq?: {
    setup?: {
      downloadUrl?: string;
      installPath?: string;
    };
    start?: {
      port?: string;
    };
  };
  location?: string;
}

interface SQSProperties {
  QueueName: string;
  [key: string]: string;
}

const commands = {
  elasticmq: {
    commands: {
      install: {
        usage: 'Installs ElasticMQ as local SQS',
        lifecycleEvents: ['installHandler'],
        options: {
          ElasticMQDownloadUrl: {
            type: 'string',
            usage:
              'Url to download ElasticMQ jar file. The default url is latest',
          },
          ElasticMQPath: {
            type: 'string',
            usage:
              'Directory path to install ElasticMQ. The default directory is "$PWD/.elasticmq"',
          },
        },
      },
      start: {
        lifecycleEvents: ['startHandler'],
        usage: 'Starts local SQS',
        options: {
          ElasticMQPath: {
            type: 'string',
            usage:
              'ElasticMQ installed directory path. The default directory is "$PWD/.elasticmq"',
          },
          ElasticMQPort: {
            type: 'string',
            usage:
              'The port number that ElasticMQ will use to communicate with your application. The default port is 9324',
          },
        },
      },
    },
  },
};
type Commands = typeof commands;

interface Hooks {
  [event: string]: () => Promise<any>;
}

export default class ServerlessElasticMQ {
  private options: PluginOptions;
  private service: Service;
  public commands: Commands;
  public hooks: Hooks;
  private port?: number;
  private sqsClient?: Sqs;
  private lambda: typeof Lambda;
  constructor(private serverless: Serverless, options: PluginOptions) {
    this.options = options;
    this.service = serverless.service;
    this.commands = commands;
    this.hooks = {
      'elasticmq:install:installHandler': this.installHandler,
      'elasticmq:start:startHandler': this.startHandler,
      'before:offline:start:init': this.startHandler,
      'before:offline:start:end': this.stopHandler,
    };
  }
  public installHandler = async () => {
    const options = this.buildElasticMQOptions({
      setup: {
        downloadUrl: this.options.ElasticMQDownloadUrl,
        installPath: this.options.ElasticMQPath,
      },
    });
    await elasticmq.install(options);
  };
  private buildElasticMQOptions = (
    options: ElasticMQOptions
  ): ElasticMQOptions => {
    const config = this.getConfig(PLUGIN_NAME);
    return mergeWith({}, config.elasticmq, options, (a, b) =>
      b === null || b === undefined ? a : undefined
    );
  };
  private getConfig(name: string) {
    return ((this.service &&
      this.service.custom &&
      this.service.custom[name]) ||
      {}) as PluginConfig;
  }
  public startHandler = async () => {
    this.serverless.cli.log(`Starting Offline SQS...`);
    try {
      await this.startOfflineSQS();
    } catch (error) {
      this.serverless.cli.log(`Failed to Start Offline SQS. ${error}`);
    }
    this.serverless.cli.log(`Creating Offline SQS Queues...`);
    try {
      await this.createOfflineSQSQueues();
    } catch (error) {
      this.serverless.cli.log(`Failed to Create Offline SQS. ${error}`);
    }
    this.serverless.cli.log(`Starting Offline Kinesis...`);
    return this.startOfflineKinesis();
  };
  private startOfflineSQS = async () => {
    const { ElasticMQPort, ElasticMQPath } = this.options;
    const options = this.buildElasticMQOptions({
      setup: {
        installPath: ElasticMQPath,
      },
      start: {
        port: ElasticMQPort,
      },
    });
    this.port = elasticmq.start(options);
    await waitOn({
      resources: [`${this.endpoint}?Action=ListQueues`],
    });
  };
  private createOfflineSQSQueues = async () => {
    this.sqsClient = new Sqs({
      endpoint: this.endpoint,
      region:
        this.options.region || this.service.provider.region || 'us-east-1',
      accessKeyId: 'root',
      secretAccessKey: 'root',
    });
    if (
      this.service &&
      this.service.resources &&
      this.service.resources.Resources
    ) {
      const resources = this.service.resources.Resources;
      const promises = Object.keys(resources)
        .filter((key) => resources[key].Type === 'AWS::SQS::Queue')
        .map((key) => this.createInitialQueue(key, resources[key].Properties));
      await Promise.all(promises);
    }
  };
  private createInitialQueue = async (
    resourceName: string,
    queue: SQSProperties
  ) => {
    this.serverless.cli.log(`Creating Queue ${resourceName}`);
    const params: Sqs.CreateQueueRequest = {
      QueueName: queue.QueueName,
    };
    Object.keys(queue)
      .filter((key) => key !== 'QueueName')
      .forEach((key) => {
        const attrs: Sqs.QueueAttributeMap = {};
        attrs[key] = queue[key].toString();
        params.Attributes = attrs;
      });
    await this.sqsClient!.createQueue(params).promise();
  };
  private startOfflineKinesis = async () => {
    const sqsEventHandlers = this.service
      .getAllFunctions()
      .reduce<{ functionKey: string; events: Record<string, any> }[]>(
        (eventHandlers, functionKey) => {
          try {
            const events = this.service.getEventInFunction('sqs', functionKey);
            eventHandlers.push({
              functionKey,
              events,
            });
          } catch {
            // throw error when not exist
          }
          return eventHandlers;
        },
        []
      );
    const lambdas = sqsEventHandlers.map(({ functionKey }) => {
      const functionDefinition = this.service.getFunction(functionKey);
      return {
        functionKey,
        functionDefinition,
      };
    });
    this.lambda = new Lambda(this.serverless, {
      location: this.getConfig(PLUGIN_NAME).location,
    });
    this.lambda.create(lambdas);
    const promises = sqsEventHandlers.map(({ functionKey, events }) => {
      return this.createQueueReadable(functionKey, events['sqs']);
    });
    return promises;
  };
  private createQueueReadable = async (
    functionKey: string,
    queueEvent: any
  ) => {
    const queueName = this.getQueueName(queueEvent);
    const { QueueUrl } = await this.sqsClient!.getQueueUrl({
      QueueName: queueName,
    }).promise();
    if (!QueueUrl) {
      return;
    }
    const next = async () => {
      const { Messages } = await this.sqsClient!.receiveMessage({
        QueueUrl,
        MaxNumberOfMessages: queueEvent.batchSize,
        WaitTimeSeconds: 1,
      }).promise();
      if (Messages) {
        await this.handleEvent(queueEvent, functionKey, Messages);
        await this.sqsClient!.deleteMessageBatch({
          Entries: Messages.map(({ MessageId: Id, ReceiptHandle }) => ({
            Id: Id!,
            ReceiptHandle: ReceiptHandle!,
          })),
          QueueUrl,
        }).promise();
      }
      await next();
    };
    return next();
  };
  private getQueueName = (queueEvent: any) => {
    if (typeof queueEvent === 'string') {
      return this.extractQueueNameFromARN(queueEvent);
    }
    if (typeof queueEvent.arn === 'string') {
      return this.extractQueueNameFromARN(queueEvent.arn);
    }
    if (typeof queueEvent.queueName === 'string') {
      return queueEvent.queueName;
    }
    if (queueEvent.arn['Fn::GetAtt']) {
      const [ResourceName] = queueEvent.arn['Fn::GetAtt'];
      if (
        this.service &&
        this.service.resources &&
        this.service.resources.Resources &&
        this.service.resources.Resources[ResourceName] &&
        this.service.resources.Resources[ResourceName].Properties &&
        typeof this.service.resources.Resources[ResourceName].Properties
          .QueueName === 'string'
      ) {
        return this.service.resources.Resources[ResourceName].Properties
          .QueueName;
      }
    }
    throw new Error(`QueueName not found`);
  };
  private extractQueueNameFromARN = (arn: string) => {
    const [, , , , , QueueName] = arn.split(':');
    return QueueName;
  };
  private handleEvent = async (
    queueEvent: any,
    functionName: string,
    messages: Sqs.Message[]
  ) => {
    const streamName = this.getQueueName(queueEvent);
    this.serverless.cli.log(`${streamName} (λ: ${functionName})`);
    const lambdaFunction = this.lambda.get(functionName);
    const event = {
      Records: messages.map(
        ({
          MessageId: messageId,
          ReceiptHandle: receiptHandle,
          Body: body,
          Attributes: attributes,
          MessageAttributes: messageAttributes,
          MD5OfBody: md5OfBody,
        }) => ({
          messageId,
          receiptHandle,
          body,
          attributes,
          messageAttributes,
          md5OfBody,
          eventSource: 'aws:sqs',
          eventSourceARN: queueEvent.arn,
          awsRegion: this.options.region || this.service.provider.region,
        })
      ),
    };
    lambdaFunction.setEvent(event);
    await lambdaFunction.runHandler();
  };
  public stopHandler = async () => {
    this.serverless.cli.log('Stopping Offline SQS...');
    if (this.port) {
      elasticmq.stop(this.port);
    }
  };
  private get endpoint() {
    return `http://localhost:${this.port}`;
  }
}
