import {spawnSync} from 'node:child_process';
process.env.STUDIO_TARGET='node';
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
