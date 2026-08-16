import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const slash = value => value.split(sep).join('/');
const escapeRe = value => value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
function globRe(glob) {
  let out = '';
  for (let i=0;i<glob.length;i++) {
    const c=glob[i];
    if (c==='*' && glob[i+1]==='*' && glob[i+2]==='/') { out += '(?:.*/)?'; i += 2; }
    else if (c==='*' && glob[i+1]==='*') { out += '.*'; i++; }
    else if (c==='*') out += '[^/]*';
    else if (c==='?' ) out += '[^/]';
    else if (c==='{' ) { const j=glob.indexOf('}',i); if(j<0) out+='\\{'; else { out += '('+glob.slice(i+1,j).split(',').map(escapeRe).join('|')+')'; i=j; } }
    else out += escapeRe(c);
  }
  return new RegExp('^'+out+'$');
}
const matches=(path,glob)=>globRe(glob).test(path);
async function walk(dir, root, out=[]) {
  for (const ent of await readdir(dir,{withFileTypes:true})) {
    const full=resolve(dir,ent.name); const rel=slash(relative(root,full));
    if (ent.isDirectory()) await walk(full,root,out); else out.push(rel);
  }
  return out;
}
export function countPhysicalLines(text) {
  const normalized=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  if (!normalized) return 0;
  const trimmed=normalized.endsWith('\n') ? normalized.slice(0,-1) : normalized;
  return trimmed ? trimmed.split('\n').length : 0;
}
export async function checkLineLimits(baseDir=here, configPath=resolve(baseDir,'.line-limits.json')) {
  const config=JSON.parse(await readFile(configPath,'utf8')); const files=await walk(baseDir,baseDir); const violations=[];
  for (const path of files) {
    if (config.exclude.some(g=>matches(path,g))) continue;
    const rule=config.rules.find(r=>matches(path,r.glob)); if(!rule) continue;
    const lines=countPhysicalLines(await readFile(resolve(baseDir,path),'utf8'));
    if(lines>rule.max) violations.push({path,actual:lines,max:rule.max});
  }
  return violations;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const violations=await checkLineLimits();
  for(const v of violations) console.error(`${v.path}: ${v.actual}/${v.max}`);
  process.exitCode=violations.length ? 1 : 0;
}
