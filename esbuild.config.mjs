import { build } from "esbuild";
await build({entryPoints:["src/main.js"],bundle:true,external:["obsidian"],platform:"browser",format:"cjs",target:"es2022",outfile:"main.js", sourcemap:false});
