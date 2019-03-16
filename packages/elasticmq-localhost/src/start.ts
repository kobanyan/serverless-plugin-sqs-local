import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { defaultConfig, Options } from './Config';
import { absPath, buildConfig } from './utils';

export interface Instance {
  proc: ChildProcess;
  port: number;
}

const customConf = (port: number): string =>
  `node-address {
  protocol = http
  host = localhost
  port = ${port}
  context-path = ""
}
rest-sqs {
  enabled = true
  bind-port = ${port}
  bind-hostname = "0.0.0.0"
}
`;

export default (options: Options = {}): Instance => {
  const config = buildConfig(options);
  const { setup, start } = config;
  const { installPath, jar } = setup;
  const { port } = start;
  const absInstallPath = absPath(installPath);
  const preArgs = [] as string[];
  if (port !== defaultConfig.start.port) {
    const conf = `${port}.conf`;
    fs.writeFileSync(path.join(absInstallPath, conf), customConf(port));
    preArgs.push(`-Dconfig.file=${conf}`);
  }
  let args = ['-jar', jar];
  args = preArgs.concat(args);
  const child = spawn('java', args, {
    cwd: absInstallPath,
    env: process.env,
    stdio: ['pipe', 'pipe', process.stderr],
  });
  if (!child.pid) {
    throw new Error('Unable to start ElasticMQ process!');
  }
  child
    .on('error', err => {
      throw err;
    })
    .on('close', code => {
      if (code !== null && code !== 0) {
        throw new Error(`ElasticMQ failed to start with code: ${code}`);
      }
    });
  return {
    proc: child,
    port,
  };
};
