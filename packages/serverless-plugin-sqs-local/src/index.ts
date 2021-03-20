import Sqs from 'aws-sdk/clients/sqs';
import figures from 'figures';
import mergeWith from 'lodash.mergewith';
import * as path from 'path';
import * as Serverless from 'serverless';
import * as Service from 'serverless/classes/Service';
import waitOn from 'wait-on';
const {
  createHandler,
  getFunctionOptions,
} = require('serverless-offline/src/functionHelper');
const createLambdaContext = require('serverless-offline/src/createLambdaContext');

import elasticmq from '@serverless-plugin-sqs-local/elasticmq-localhost';
import { Options as ElasticMQOptions } from '@serverless-plugin-sqs-local/elasticmq-localhost/lib/Config';

const PLUGIN_NAME = 'serverless-plugin-sqs-local';

type PluginOptions = Serverless.Options & {
  ElasticMQDownloadUrl?: string;
  ElasticMQPath?: string;
  ElasticMQPort?: number;
  providedRuntime?: string;
};

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
            usage:
              'Url to download ElasticMQ jar file. The default url is latest',
          },
          ElasticMQPath: {
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
            usage:
              'ElasticMQ installed directory path. The default directory is "$PWD/.elasticmq"',
          },
          ElasticMQPort: {
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

const fromCallback = (fun: any) =>
  new Promise((resolve, reject) => {
    fun((err: any, data: any) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });

type Callback = (err?: any, data?: any) => void;

export default class ServerlessElasticMQ {
  private options: PluginOptions;
  private service: Service;
  public commands: Commands;
  public hooks: Hooks;
  private port?: number;
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
    return (
      (this.service && this.service.custom && this.service.custom[name]) || {}
    );
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
    await this.getClient().createQueue(params).promise();
  };
  private getClient = () => {
    return new Sqs({
      endpoint: this.endpoint,
      region:
        this.options.region || this.service.provider.region || 'us-east-1',
      accessKeyId: 'root',
      secretAccessKey: 'root',
    });
  };
  private startOfflineKinesis = async () => {
    const promises = this.service
      .getAllFunctions()
      .filter((functionName) => {
        try {
          this.service.getEventInFunction('sqs', functionName);
        } catch {
          // throw error when not exist
          return false;
        }
        return true;
      })
      .map((functionName) => {
        const sqsEvent = this.service.getEventInFunction(
          'sqs',
          functionName
        ) as { [key: string]: any };
        return this.createQueueReadable(functionName, sqsEvent['sqs']);
      });
    return promises;
  };
  private createQueueReadable = async (
    functionName: string,
    queueEvent: any
  ) => {
    const client = this.getClient();
    const queueName = this.getQueueName(queueEvent);
    this.serverless.cli.log(`${queueName}`);
    const resUrl = await client
      .getQueueUrl({
        QueueName: queueName,
      })
      .promise();
    const QueueUrl = resUrl.QueueUrl;
    if (!QueueUrl) {
      return;
    }
    const next = async () => {
      const resMessage = await client
        .receiveMessage({
          QueueUrl,
          MaxNumberOfMessages: queueEvent.batchSize,
          WaitTimeSeconds: 1,
        })
        .promise();
      const Messages = resMessage.Messages;
      if (Messages) {
        await fromCallback((cb: Callback) =>
          this.eventHandler(queueEvent, functionName, Messages, cb)
        );
        await client
          .deleteMessageBatch({
            Entries: Messages.map(({ MessageId: Id, ReceiptHandle }) => ({
              Id: Id!,
              ReceiptHandle: ReceiptHandle!,
            })),
            QueueUrl,
          })
          .promise();
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
  private eventHandler = (
    queueEvent: any,
    functionName: string,
    messages: Sqs.Message[],
    cb: Callback
  ) => {
    const streamName = this.getQueueName(queueEvent);
    this.serverless.cli.log(`${streamName} (λ: ${functionName})`);
    const { location = '.' } = this.getConfig('serverless-offline');
    const func = this.service.getFunction(functionName);
    const servicePath = path.join(this.serverless.config.servicePath, location);
    let serviceRuntime = this.service.provider.runtime;
    if (!serviceRuntime) {
      throw new Error('Missing required property "runtime" for provider.');
    }
    if (typeof serviceRuntime !== 'string') {
      throw new Error(
        'Provider configuration property "runtime" wasn\'t a string.'
      );
    }
    if (serviceRuntime === 'provided') {
      if (this.options.providedRuntime) {
        serviceRuntime = this.options.providedRuntime;
      } else {
        throw new Error(
          'Runtime "provided" is unsupported. Please add a --providedRuntime CLI option.'
        );
      }
    }
    if (
      !(
        serviceRuntime.startsWith('nodejs') ||
        serviceRuntime.startsWith('python') ||
        serviceRuntime.startsWith('ruby')
      )
    ) {
      this.serverless.cli.log(
        `Warning: found unsupported runtime '${serviceRuntime}'`
      );
      return;
    }
    const funOptions = getFunctionOptions(
      func,
      functionName,
      servicePath,
      serviceRuntime
    );
    const handler = createHandler(funOptions, {});
    const lambdaContext = createLambdaContext(func, (err: any, data: any) => {
      this.serverless.cli.log(
        `[${err ? figures.cross : figures.tick}] ${JSON.stringify(data) || ''}`
      );
      cb(err, data);
    });
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
    if (handler.length < 3) {
      handler(event, lambdaContext)
        .then((res: any) => lambdaContext.done(null, res))
        .catch(lambdaContext.done);
    } else {
      handler(event, lambdaContext, lambdaContext.done);
    }
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

// type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// type ConfigurableSetupConfig = Partial<Omit<SetupConfig, 'jar'>>;

// type ConfigurableStartConfig = Partial<StartConfig>;

// interface ConfigurableConfig {
//   setup?: ConfigurableSetupConfig;
//   start?: ConfigurableStartConfig;
// }

// export default ConfigurableConfig;
