import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';
import ProgressBar from 'progress';

import { Options } from './Config';
import { absPath, buildConfig } from './utils';

export interface InstallResult {
  status: 'already-installed' | 'success';
  filePath: string;
}

const download = async (
  downloadUrl: string,
  filePath: string
): Promise<InstallResult> => {
  console.log(
    `Started downloading ElasticMQ from ${downloadUrl} to ${filePath} .`
  );
  console.log('Process may take few minutes.');
  try {
    const res = await fetch(downloadUrl);
    const len = parseInt(res.headers.get('content-length') || '0', 10);
    const bar = new ProgressBar('Downloading ElasticMQ [:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 40,
      total: len,
    });
    if (res.status !== 200) {
      throw new Error(`Error getting ElasticMQ jar: ${res.status}`);
    }
    return await new Promise<InstallResult>((resolve, reject) => {
      const fileStream = fs.createWriteStream(filePath);
      res.body
        .on('data', chunk => {
          bar.tick(chunk.length);
        })
        .pipe(fileStream)
        .on('error', err => {
          reject(err);
        })
        .on('finish', () => {
          console.log('\nElasticMQ installation complete!');
          resolve({
            status: 'success',
            filePath,
          });
        });
    });
  } catch (error) {
    throw new Error(`Error in downloading ElasticMQ ${error}`);
  }
};

export default async (options: Options = {}): Promise<InstallResult> => {
  const config = buildConfig(options);
  const { downloadUrl, installPath, jar } = config.setup;
  const absInstallPath = absPath(installPath);
  try {
    const filePath = path.join(absInstallPath, jar);
    if (fs.existsSync(filePath)) {
      console.log(`ElasticMQ is already installed on ${filePath} !`);
      return {
        status: 'already-installed',
        filePath,
      };
    } else {
      if (!fs.existsSync(absInstallPath)) {
        fs.mkdirSync(absInstallPath);
      }
      return await download(downloadUrl, filePath);
    }
  } catch (err) {
    throw new Error('Error configuring or installing ElasticMQ local ' + err);
  }
};
