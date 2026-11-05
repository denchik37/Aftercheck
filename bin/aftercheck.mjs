#!/usr/bin/env node
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {evaluate} from '../src/evaluate.ts';
import {renderMarkdown} from '../src/report.ts';

const [observationFile,policyFile,outDirectory='aftercheck-output']=process.argv.slice(2);
if(!observationFile||!policyFile){
  console.error('Usage: aftercheck <observation.json> <policy.json> [output-directory]');
  process.exitCode=1;
}else{
  try{
    async function readJson(path){
      const text=await readFile(resolve(path),'utf8');
      if(Buffer.byteLength(text,'utf8')>2_000_000)throw Error('Input is larger than 2MB');
      return JSON.parse(text);
    }
    const observation=await readJson(observationFile);
    const policy=await readJson(policyFile);
    const report=evaluate(observation,policy);
    await mkdir(resolve(outDirectory),{recursive:true,mode:0o700});
    await writeFile(join(resolve(outDirectory),'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    await writeFile(join(resolve(outDirectory),'report.md'),renderMarkdown(report),{mode:0o600});
    console.log(`[${report.evidenceClass}] execution=${report.execution} support=${report.support} evidence=${report.coverage} verdict=${report.verdict}`);
    console.log(`Saved report.json and report.md in ${resolve(outDirectory)}`);
    process.exitCode=report.verdict==='PASS'?0:report.verdict==='VIOLATION'?2:3;
  }catch(error){
    const msg=error instanceof Error?error.message:'UNKNOWN_ERROR';
    console.error(`Unable to evaluate input: ${msg}`);
    process.exitCode=1;
  }
}
