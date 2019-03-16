import { Options } from './Config';
import install from './install';
import start, { Instance } from './start';
import { buildConfig } from './utils';

interface Instances {
  [port: number]: Instance;
}

class ElasticMQ {
  private instances: Instances = {};
  constructor() {
    // noop
  }
  public install = async (options: Options = {}) => {
    const config = buildConfig(options);
    return await install(config);
  };
  public start = (options: Options = {}): number => {
    const config = buildConfig(options);
    const instance = start(config);
    this.instances[instance.port] = instance;
    console.log(`ElasticMQ Started, http://localhost:${instance.port}`);
    return instance.port;
  };
  public stop = (port: number) => {
    if (this.instances[port]) {
      this.instances[port].proc.kill('SIGKILL');
      delete this.instances[port];
    }
  };
}
const elasticmq = new ElasticMQ();
export default elasticmq;
