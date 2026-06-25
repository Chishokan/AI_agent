// 各エージェント機能のプロンプト組み立てと、キー未設定時のテンプレfallback。
import type { TargetResult, SupplyResult } from "./agentCalc";

const SYSTEM_BASE =
  "あなたは学習塾の校門配布マーケティングを支援するアシスタントです。" +
  "数字は与えられた集計値のみを使い、作り話で埋めないこと。反応率は必ず分母（配布枚数）を明示。" +
  "個人情報は扱わない。出力は日本語で、人がそのまま会議資料に貼れる簡潔な体裁にする。";

export function planSystem() {
  return SYSTEM_BASE + " 与えられた算出結果をもとに、配布計画（配布場所・時期・枚数の方針）を簡潔にまとめる。";
}
export function analyzeSystem() {
  return SYSTEM_BASE + " 与えられた集計から、気づき（伸び/落ち・チャネル傾向・目標差）を箇条書きで簡潔に述べる。";
}
export function proposalSystem() {
  return SYSTEM_BASE + " 現状→課題→施策案→期待効果→リソース/リスク の構成で提案ドラフトを書く。最終判断は人が行う旨を添える。";
}

export function planUser(result: TargetResult | SupplyResult): string {
  return "次の配布数算出結果をもとに配布計画をまとめてください。\n```json\n" + JSON.stringify(result, null, 2) + "\n```";
}

export function planFallback(result: TargetResult | SupplyResult): string {
  if (result.mode === "target") {
    const lines = result.breakdown.map((b) => `  - ${b.campus}: ${b.sheets.toLocaleString()}枚（想定${b.expected}件）`);
    return [
      `【配布計画 / target】${result.area}：${result.channel} ${result.targetResponses}件`,
      `- 必要配布枚数: 約 ${result.requiredSheets.toLocaleString()} 枚`,
      `- 反応率: ${(result.responseRate * 100).toFixed(2)}%（分母=配布枚数 / 出所: ${result.rateSource}）`,
      ...(lines.length ? ["- 拠点別内訳:", ...lines] : []),
      ...(result.notes.length ? ["", "注記:", ...result.notes.map((n) => `- ${n}`)] : []),
    ].join("\n");
  }
  const lines = result.allocation.map(
    (a) => `  - ${a.area}: ${a.sheets.toLocaleString()}枚（反応率${(a.responseRate * 100).toFixed(2)}% / 想定${a.expected}件 / ${a.rateSource}）`,
  );
  return [
    `【配布計画 / supply】在庫 ${result.totalSheets.toLocaleString()} 枚を ${result.weightBy} 基準で配分`,
    "- 配分:",
    ...lines,
    `- 想定 ${result.channel} 合計: 約 ${result.totalExpected} 件`,
    ...(result.notes.length ? ["", "注記:", ...result.notes.map((n) => `- ${n}`)] : []),
  ].join("\n");
}
