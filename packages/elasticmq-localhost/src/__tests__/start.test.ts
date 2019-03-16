import waitOn from 'wait-on';

import { Options } from '../config';
import install from '../install';
import start, { Instance } from '../start';

describe('start', () => {
  const ONE_SECOND = 1000;
  const ONE_MINUTE = ONE_SECOND * 60;
  const installPath = './.elasticmq-start';
  const instances: Instance[] = [];
  const assert = async (options: Options, expectedPort: number) => {
    await install(options);
    const instance = start(options);
    expect(instance.proc).not.toBeFalsy();
    expect(instance.port).toEqual(expectedPort);
    instances.push(instance);
    await waitOn({
      resources: [`tcp:${instance.port}`],
      tcpTimeout: ONE_SECOND,
    });
  };
  afterAll(() => {
    instances.forEach(instance => instance.proc.kill('SIGKILL'));
  });
  it(
    'should start with default port',
    async () => {
      const options = { setup: { installPath } };
      await assert(options, 9324);
    },
    ONE_MINUTE
  );
  it(
    'should start with specific port',
    async () => {
      const options = { setup: { installPath }, start: { port: 9325 } };
      await assert(options, 9325);
    },
    ONE_MINUTE
  );
});
