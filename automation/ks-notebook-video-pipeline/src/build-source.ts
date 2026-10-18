import fs from 'node:fs';
import path from 'node:path';

export type BuildInput = {
  date: string;
  ranking: string;
  typhoon_swell?: string;
  tomorrow_forecast?: string;
};

// A factual NotebookLM source, deliberately free of instructions about voice, style or editing.
// Do not replace the user's ellipses, rank order, spot names, scores or wind directions.
export function buildSource(input: BuildInput): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('DATE_INVALID');
  if (typeof input.ranking !== 'string' || !input.ranking.trim()) throw new Error('RANKING_MISSING');
  const typhoon = input.typhoon_swell?.trim() || '未提供';
  const tomorrow = input.tomorrow_forecast?.trim() || '未提供';
  return [
    '# 関西サーファーKS 日次入力',
    '',
    '## 日付',
    input.date,
    '',
    '## 今日の波ランキング',
    input.ranking, // original, not normalized
    '',
    '## 台風・うねりの事実情報',
    typhoon,
    '',
    '## 明日の独立予報データ',
    tomorrow,
    ''
  ].join('\n');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/build-source.ts')) {
  const inputFile = process.argv[2];
  if (!inputFile) throw new Error('Usage: tsx src/build-source.ts <input.json> [source.md]');
  const raw = fs.readFileSync(inputFile, 'utf8').replace(/^\uFEFF/, '');
  const input = JSON.parse(raw) as BuildInput;
  const out = process.argv[3] ?? path.resolve('source.md');
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, buildSource(input), 'utf8');
  console.log(out);
}
