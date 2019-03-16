export interface SetupConfig {
  downloadUrl: string;
  installPath: string;
  jar: string;
}

export interface StartConfig {
  port: number;
}

export default interface Config {
  setup: SetupConfig;
  start: StartConfig;
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type SetupOptions = Partial<Omit<SetupConfig, 'jar'>>;

export type StartOptions = Partial<StartConfig>;

export interface Options {
  setup?: SetupOptions;
  start?: StartOptions;
}

export const defaultConfig: Config = {
  setup: {
    downloadUrl:
      'http://s3-eu-west-1.amazonaws.com/softwaremill-public/elasticmq-server-0.14.6.jar',
    installPath: './.elasticmq',
    jar: 'elasticmq-server.jar',
  },
  start: {
    port: 9324,
  },
};
