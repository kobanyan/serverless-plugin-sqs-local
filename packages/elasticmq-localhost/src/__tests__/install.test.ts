import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import { defaultConfig } from '../config';
import install from '../install';

describe('install', () => {
  const ONE_MINUTE = 1000 * 60;
  const installPath = './.elasticmq-options';
  it(
    'should install elasticmq',
    async () => {
      rimraf.sync(installPath!);
      const res = await install({ setup: { installPath } });
      expect(res).toEqual({
        status: 'success',
        filePath: path.join(path.resolve(installPath), defaultConfig.setup.jar),
      });
      expect(fs.existsSync(res.filePath)).toBeTruthy();
    },
    ONE_MINUTE
  );
  it('should skip to install elasticmq', async () => {
    const res = await install({ setup: { installPath } });
    expect(res).toEqual({
      status: 'already-installed',
      filePath: path.join(path.resolve(installPath), defaultConfig.setup.jar),
    });
    expect(fs.existsSync(res.filePath)).toBeTruthy();
  });
  it('should throw error when download url is incorrect', async () => {
    rimraf.sync(installPath);
    await expect(
      install({
        setup: {
          downloadUrl:
            'http://s3-eu-west-1.amazonaws.com/softwaremill-public/elasticmq-server-0.0.0.jar',
        },
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Error configuring or installing ElasticMQ local Error: Error in downloading ElasticMQ Error: Error getting ElasticMQ jar: 403"`
    );
  });
  it('should throw error when host is incorrect', async () => {
    rimraf.sync(installPath);
    await expect(
      install({
        setup: {
          downloadUrl: 'http://unknownhost/unknown.jar',
        },
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Error configuring or installing ElasticMQ local Error: Error in downloading ElasticMQ FetchError: request to http://unknownhost/unknown.jar failed, reason: getaddrinfo ENOTFOUND unknownhost"`
    );
  });
});
