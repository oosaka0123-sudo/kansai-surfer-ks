import fs from 'node:fs';
import path from 'node:path';

type BuildInput={
  date:string;
  ranking:string;
  typhoon_swell?:string;
  tomorrow_forecast?:string;
};

export function buildSource(input:BuildInput){
  return `# 関西サーファーKS 日次入力

## 日付
${input.date}

## 今日の波ランキング
${input.ranking.trim()}

## 最新の台風・うねり情報
${(input.typhoon_swell ?? '個別の情報は確認できません').trim()}

## 明日の予報データ
${(input.tomorrow_forecast ?? '個別の情報は確認できません').trim()}

---
このファイルは当日の事実データのみを収録する。
順位・点数・波サイズ・風向きはユーザー入力を正本とし、再計算・補完・並べ替えを行わない。
波の周期は動画説明に使用しない。
`;
}

if(process.argv[1]?.replace(/\\/g,'/').endsWith('/build-source.ts')){
  const inputFile=process.argv[2];
  if(!inputFile) throw new Error('Usage: tsx src/build-source.ts <input.json>');
  const raw=fs.readFileSync(inputFile,'utf8').replace(/^\uFEFF/,'');
  const input=JSON.parse(raw) as BuildInput;
  const out=process.argv[3] ?? path.resolve('source.md');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,buildSource(input),'utf8');
  console.log(out);
}
