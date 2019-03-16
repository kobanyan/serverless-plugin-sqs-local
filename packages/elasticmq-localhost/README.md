# elasticmq-localhost

This library works as a wrapper for [ElasticMQ](https://github.com/softwaremill/elasticmq), intended for use in devops. This library is capable of downloading and installing the ElasticMQ with a simple set of commands, and pass optional attributes.

## Requires

- Java Runtime Engine (JRE) version 8 or newer

## Features

- Method to Download/Install ElasticMQ
- Start/Restart ElasticMQ with the options
- Stop individual instances of ElasticMQ running

## Installation

`npm install --save-dev @serverless-plugin-sqs-local/elasticmq-localhost`

## Usage

Usage example

```
var elasticmq = require("@serverless-plugin-sqs-local/elasticmq-localhost");
elasticmq.install(); /* This is one time operation. Safe to execute multiple times which installs ElasticMQ once. All the other methods depends on this. */
elasticmq.start();
```

Supported methods

```
install(options)  To install ElasticMQ for usage (This is one time operation unless remove)
start(options)    To start an instance of ElasticMQ. More information about options shown in the coming section
stop(port)        To stop particular instance of ElasticMQ running on an specified port
```

NOTE: After executing start(options), ElasticMQ will process incoming requests until you stop it. To stop ElasticMQ, type Ctrl+C in the command prompt window.

All options:

```js
setup: {
  downloadUrl: 'http://s3-eu-west-1.amazonaws.com/softwaremill-public/elasticmq-server-0.14.6.jar', // Url to download ElasticMQ
  installPath: './.elasticmq', // Directory path to install ElasticMQ
},
start: {
  port: 9324, // ElasticMQ listening port number
},
```

## Credits

This project is heavily inspired by the following projects.

- [dynamodb-localhost](https://github.com/99xt/dynamodb-localhost)
