import * as path from 'path';
import * as rimraf from 'rimraf';
import waitOn from 'wait-on';

import { defaultConfig, Options } from '../Config';
import elasticmq from '../index';

describe('ElasticMQ', () => {
  const ONE_SECOND = 1000;
  const ONE_MINUTE = ONE_SECOND * 60;
  const downloadUrl =
    'http://s3-eu-west-1.amazonaws.com/softwaremill-public/elasticmq-server-0.14.6.jar';
  const installPath = '.elasticmq-index';
  const options: Options = {
    setup: {
      downloadUrl,
      installPath,
    },
  };
  afterAll(() => {
    elasticmq.stop(9329);
    elasticmq.stop(9328);
    elasticmq.stop(9327);
  });
  it(
    'should install ElasticMQ',
    async () => {
      rimraf.sync(installPath!);
      const install = await elasticmq.install(options);
      expect(install).toEqual({
        status: 'success',
        filePath: path.join(path.resolve(installPath), defaultConfig.setup.jar),
      });
    },
    ONE_MINUTE
  );
  it(
    'should start ElasticMQ',
    async () => {
      const start = async (port: number) => {
        expect(
          elasticmq.start({ setup: options.setup, start: { port } })
        ).toEqual(port);
        await waitOn({
          resources: [`tcp:${port}`],
          tcpTimeout: ONE_SECOND,
        });
      };
      await start(9327);
      await start(9328);
    },
    ONE_MINUTE
  );
});
