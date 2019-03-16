import * as path from 'path';

import { defaultConfig, Options } from '../config';
import { absPath, buildConfig } from '../utils';

describe('utils', () => {
  describe('absPath', () => {
    it('should convert relative path to absolute path', () => {
      expect(absPath('test')).toEqual(path.join(process.cwd(), 'test'));
    });
    it('should convert relative path with dot to absolute path', () => {
      expect(absPath('./test')).toEqual(path.join(process.cwd(), 'test'));
    });
    it('should return path as same as parameter', () => {
      expect(absPath('/a/b/c')).toEqual('/a/b/c');
    });
  });
  describe('buildConfig', () => {
    const options: Options = {
      setup: {
        downloadUrl: 'options-downloadUrl',
        installPath: 'options-installPath',
      },
      start: {
        port: 9325,
      },
    };
    it('should favor options to config', () => {
      const config = buildConfig(options);
      expect(config).toEqual({
        setup: {
          downloadUrl: 'options-downloadUrl',
          installPath: 'options-installPath',
          jar: 'elasticmq-server.jar',
        },
        start: {
          port: 9325,
        },
      });
    });
    it('should use default config', () => {
      const config = buildConfig();
      expect(config).toEqual(defaultConfig);
    });
  });
});
