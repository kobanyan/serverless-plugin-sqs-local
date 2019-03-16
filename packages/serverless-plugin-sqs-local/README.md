# serverless-plugin-sqs-local

Serverless SQS Plugin - Allows to run SQS locally for serverless

## Requires

- [Serverless](https://serverless.com)
- [Serverless Offline](https://github.com/dherault/serverless-offline)
- Java Runtime Engine (JRE) version 8 or newer

## Features

- Install [ElasticMQ](https://github.com/softwaremill/elasticmq) as local SQS
- Start local SQS with the specific port
- Queue Creation for local SQS
- Trigger lambda function
- [Serverless Webpack](https://github.com/serverless-heaven/serverless-webpack/) support

## Install Plugin

First, add this plugin to your project:

```
npm install --save-dev @serverless-plugin-sqs-local/serverless-plugin-sqs-local
# or
yarn add --dev @serverless-plugin-sqs-local/serverless-plugin-sqs-local
```

Then inside your project's serverless.yml file, add following entry to the plugins section before serverless-offline (and after serverless-webpack if presents).

```yaml
plugins:
  - serverless-webpack
  - '@serverless-plugin-sqs-local/serverless-plugin-sqs-local'
  - serverless-offline
```

[See example](https://github.com/kobanyan/serverless-plugin-sqs-local/tree/master/examples/webpack).

## Using the Plugin

1. Install ElasticMQ as local SQS `sls elasticmq install`
1. Add SQS Resource definitions to your project's serverless.yml file
1. Start local SQS `sls elasticmq start` or `sls offline start`

### Install: sls elasticmq install

All CLI options are optional:

```
--ElasticMQDownloadUrl  Url to download ElasticMQ jar file. The default url is latest
--ElasticMQPath         Directory path to install ElasticMQ. The default directory is "$PWD/.elasticmq"
```

[See example](https://github.com/kobanyan/serverless-plugin-sqs-local/tree/master/examples/options/package.json).

All the above options can be added to serverless.yml to set default configuration: e.g.

```yaml
custom:
  serverless-plugin-sqs-local:
    setup:
      downloadUrl: 'https://s3-eu-west-1.amazonaws.com/softwaremill-public/elasticmq-server-0.13.8.jar'
      installPath: '.ElasticMQ'
```

[See example](https://github.com/kobanyan/serverless-plugin-sqs-local/tree/master/examples/config/serverless.yml).

### Start: sls elasticmq start

All CLI options are optional:

```
--ElasticMQPath  ElasticMQ installed directory path. The default directory is "$PWD/.elasticmq"
--ElasticMQPort  The port number that ElasticMQ will use to communicate with your application. The default port is 9324
```

All the above options can be added to serverless.yml to set default configuration: e.g.

```yaml
custom:
  serverless-plugin-sqs-local:
    setup:
      installPath: '.ElasticMQ'
    start:
      port: 9325
```

[See example](https://github.com/kobanyan/serverless-plugin-sqs-local/tree/master/examples/config/serverless.yml).

### Configuration function and SQS

The configuration of function and SQS of the plugin follows the [serverless documentation](https://serverless.com/framework/docs/providers/aws/events/sqs/).

[See example](https://github.com/kobanyan/serverless-plugin-sqs-local/tree/master/examples/example/serverless.yml).

## Credits

This project is heavily inspired by the following projects.

- [serverless-offline-sqs](https://github.com/CoorpAcademy/serverless-plugins/tree/master/packages/serverless-offline-sqs)
- [serverless-dynamodb-local](https://github.com/99xt/serverless-dynamodb-local)
- [dynamodb-localhost](https://github.com/99xt/dynamodb-localhost)
