import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const example=resolve('examples/synthetic-observation.json');
const policy=resolve('examples/synthetic-policy.json');
function run(observation,policy,out){return spawnSync(process.execPath,['--experimental-strip-types',resolve('bin/aftercheck.mjs'),observation,policy,out],{encoding:'utf8'});}

test('CLI creates deterministic JSON/Markdown PASS for explicitly synthetic fixture',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aftercheck-cli-'));
 try{
   const out=join(dir,'out');
   const result=run(example,policy,out);
   assert.equal(result.status,0,result.stderr);
   assert.match(result.stdout,/SYNTHETIC_FIXTURE.*verdict=PASS/);
   const json=await readFile(join(out,'report.json'),'utf8');
   const markdown=await readFile(join(out,'report.md'),'utf8');
   assert.equal(JSON.parse(json).verdict,'PASS');
   assert.match(markdown,/Evidence class:\*\* SYNTHETIC_FIXTURE/);
   assert.match(markdown,/not an authenticated onchain receipt/);
   assert.equal(run(example,policy,out).status,0);
   assert.equal(await readFile(join(out,'report.json'),'utf8'),json);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('CLI returns distinct exit code for violation and reserve UNKNOWN',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aftercheck-cli-'));
 try{
  const original=JSON.parse(await readFile(policy,'utf8'));
  const violation=join(dir,'violation.json');
  await writeFile(violation,JSON.stringify({...original,maxInputRaw:'400'}));
  const r1=run(example,violation,join(dir,'violation'));
  assert.equal(r1.status,2,r1.stderr);
  const unknown=join(dir,'unknown.json');
  await writeFile(unknown,JSON.stringify({...original,reserveFloorRaw:'100'}));
  const r2=run(example,unknown,join(dir,'unknown'));
  assert.equal(r2.status,3,r2.stderr);
  const unknownReport=JSON.parse(await readFile(join(dir,'unknown','report.json'),'utf8'));
  assert.equal(unknownReport.verdict,'UNKNOWN');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('CLI rejects invalid JSON input and does not write a report',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aftercheck-cli-'));
 try{
  const invalid=join(dir,'broken.json'); await writeFile(invalid,'{not json}');
  const result=run(example,invalid,join(dir,'out'));
  assert.equal(result.status,1);assert.match(result.stderr,/Unable to evaluate/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
