// Claude API 連携。会社の Claude Console アカウントのキー（ANTHROPIC_API_KEY）を使う。
// キーが無い環境ではテンプレ生成にフォールバックできるよう、未設定時は null を返す。
import Anthropic from "@anthropic-ai/sdk";

export function hasClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * system + user から本文テキストを生成。キー未設定なら null。
 * モデルは claude-opus-4-8、adaptive thinking、effort=medium（コスト配慮）。
 */
export async function generate(system: string, user: string): Promise<string | null> {
  if (!hasClaude()) return null;
  const client = new Anthropic();
  // output_config / thinking は新しめのAPI項目のため、SDKの型差異を避けて緩く渡す。
  const params = {
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: user }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;

  const res = await client.messages.create(params);
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
