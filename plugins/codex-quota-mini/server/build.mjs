import {build} from 'esbuild';
await build({entryPoints:['index.mjs'],bundle:true,platform:'node',format:'esm',outfile:'dist/index.mjs',
 banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}});
