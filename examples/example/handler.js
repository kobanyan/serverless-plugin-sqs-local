'use strict';
const SQS = require('aws-sdk/clients/sqs');
const sqs = new SQS({
  endpoint: 'http://localhost:9324',
});
const ping = async event => {
  try {
    const gqRes = await sqs
      .getQueueUrl({
        QueueName: 'ping',
        QueueOwnerAWSAccountId: event.requestContext.accountId,
      })
      .promise();
    const smRes = await sqs
      .sendMessage({
        QueueUrl: gqRes.QueueUrl,
        MessageBody: 'ping',
      })
      .promise();
    const { $response, ...result } = smRes;
    return {
      statusCode: 200,
      body: JSON.stringify({
        input: event,
        result,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};

const pong = async event => {
  console.log(JSON.stringify(event));
};

module.exports = {
  ping,
  pong,
};
