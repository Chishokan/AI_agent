# MCPツール1号（haifu-tool）

校門配布（販促ティッシュ等）の配布数を算出する自作 MCP サーバー。
ソースは `mcp-tool-1/`。Claude Code からは `.mcp.json` 経由で `haifu-tool` として配線される。

## 2モード

| モード | ツール名 | 用途 |
| --- | --- | --- |
| target mode | `plan_by_target` | 目標反応数から必要配布枚数を逆算（在籍数で部門別に内訳化） |
| supply mode | `plan_by_supply` | 手元在庫を各校舎へ配分（在籍数比 / 反応率比 / 均等） |

反応率（配布1枚あたりの反応数）は `data/distribution.db` の過去実績から算出する。
実績が無い校舎・チャネルは既定値にフォールバックし、出力の `rate_source`（`db` / `default` / `manual`）に明示する。
DB は読み取り専用で開き、集計値のみを扱う（個人情報は持たない）。

## ビルド

Node.js 22.5 以上が必要（`node:sqlite` を使うため）。

```sh
cd mcp/mcp-tool-1
npm install
npm run build      # tsc で dist/ に出力
```

## 動作確認（任意）

```sh
# DB を初期化していれば、stdio で起動して MCP クライアントから叩ける
node --experimental-sqlite dist/index.js
```

## 環境変数

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `HAIFU_DB_PATH` | `./data/distribution.db` | 参照する SQLite DB のパス |
| `HAIFU_DEFAULT_RATE` | `0.005` | 実績なし時のフォールバック反応率（配布1枚あたり） |

`.mcp.json` では `node --experimental-sqlite mcp/mcp-tool-1/dist/index.js` で起動する
（`node:sqlite` は Node 22 系では実験的機能のためフラグが必要。起動時の警告は stderr に出るだけで MCP 通信には影響しない）。

## ツール入出力

### plan_by_target
入力: `campus`(必須), `target_responses`(必須), `channel`(既定 体験申込), `division`, `response_rate`(手動上書き), `default_rate`
出力: `required_sheets`, `response_rate`, `rate_source`, `rate_basis`, 部門別 `breakdown`, `notes`

### plan_by_supply
入力: `total_sheets`(必須), `campuses`(既定 全5校舎), `weight_by`(enrollment/response_rate/equal), `channel`, `division`
出力: 校舎別 `allocation`（配分枚数・想定反応数）, `total_expected_responses`, `notes`
