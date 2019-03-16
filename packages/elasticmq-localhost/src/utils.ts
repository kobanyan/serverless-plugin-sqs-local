import mergeWith from 'lodash.mergewith';
import * as path from 'path';

import Config, { defaultConfig, Options } from './Config';

export const absPath = (relPath: string): string => {
  return path.isAbsolute(relPath) ? relPath : path.resolve(relPath);
};

export const buildConfig = (options: Options = {}): Config => {
  return mergeWith({}, defaultConfig, options, (a, b) =>
    b === null || b === undefined ? a : undefined
  );
};
