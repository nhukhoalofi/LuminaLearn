import { Config } from '@remotion/cli/config';

Config.setChromiumOptions({
  gl: 'angle',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote'
  ]
});
Config.setConcurrency(2);
Config.setCodec('h264');
