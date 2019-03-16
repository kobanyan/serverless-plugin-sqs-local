import { APIGatewayProxyHandler, SQSHandler } from 'aws-lambda';
import * as SQS from 'aws-sdk/clients/sqs';
import 'source-map-support/register';

const sqs = new SQS({
  endpoint: 'http://localhost:9324',
});

export const ping: APIGatewayProxyHandler = async event => {
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

export const pong: SQSHandler = async event => {
  console.log(JSON.stringify(event));
};
