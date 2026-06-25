/**
 * マスタ投入 seed。
 * - 組織マスタ（部門 / 地区 / 拠点）はユーザー確定の構造に基づく確定値。
 * - 中等部の在籍は共有シート②から読み取った「下書き（draft=true / 要検証）」。
 *   年度（2025想定）と数値は担当者の確認後に確定する。
 * - 個人情報は一切含めない。
 *
 * 実行: webapp/ で `npx prisma db seed`（package.json の prisma.seed に設定）
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 初期ログインアカウント（初回起動用・要パスワード変更）。
// パスワードは環境変数 SEED_STAFF_PASSWORD で上書き可。既定は "change-me"。
const SEED_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? "change-me";
const STAFF: Array<{ email: string; name: string; role: string }> = [
  { email: "red@example.com", name: "RED個別担当", role: "RED個別担当" },
  { email: "chu@example.com", name: "中等部担当", role: "中等部担当" },
];

const DIVISIONS = ["中等部", "RED個別"] as const;

// 地区 -> 計画担当
const AREAS: Array<{ name: string; plannerRole: string; note?: string }> = [
  { name: "駅前地区", plannerRole: "RED個別担当", note: "駅前校+京町教室+ネクスタ" },
  { name: "大野地区", plannerRole: "RED個別担当", note: "大野校+大野教室" },
  { name: "日野地区", plannerRole: "RED個別担当", note: "日野校+日野教室" },
  { name: "日宇", plannerRole: "中等部担当", note: "中等部単独（例外）" },
  { name: "広田", plannerRole: "RED個別担当", note: "単独RED戦略" },
  { name: "大島", plannerRole: "RED個別担当", note: "単独RED戦略" },
  { name: "佐々", plannerRole: "RED個別担当", note: "単独RED戦略" },
];

// 拠点 -> 部門 / 地区
const CAMPUSES: Array<{ name: string; division: string; area: string }> = [
  { name: "駅前校", division: "中等部", area: "駅前地区" },
  { name: "京町教室", division: "RED個別", area: "駅前地区" },
  { name: "ネクスタ", division: "RED個別", area: "駅前地区" },
  { name: "大野校", division: "中等部", area: "大野地区" },
  { name: "大野教室", division: "RED個別", area: "大野地区" },
  { name: "日野校", division: "中等部", area: "日野地区" },
  { name: "日野教室", division: "RED個別", area: "日野地区" },
  { name: "日宇校", division: "中等部", area: "日宇" },
  { name: "広田教室", division: "RED個別", area: "広田" },
  { name: "大島教室", division: "RED個別", area: "大島" },
  { name: "佐々教室", division: "RED個別", area: "佐々" },
];

// 中等部 在籍（下書き・要検証）: シート②「智翔館」中1〜3 計（今年, 4〜7月）。年は2025想定。
const CHUTOBU_ENROLLMENT_DRAFT: Record<string, Record<string, number>> = {
  駅前校: { "2025-04": 59, "2025-05": 59, "2025-06": 53, "2025-07": 53 },
  大野校: { "2025-04": 18, "2025-05": 18, "2025-06": 16, "2025-07": 16 },
  日宇校: { "2025-04": 19, "2025-05": 19, "2025-06": 16, "2025-07": 16 },
  日野校: { "2025-04": 38, "2025-05": 38, "2025-06": 32, "2025-07": 32 },
};

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const s of STAFF) {
    await prisma.staff.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role },
      create: { ...s, passwordHash },
    });
  }
  for (const name of DIVISIONS) {
    await prisma.division.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const a of AREAS) {
    await prisma.area.upsert({
      where: { name: a.name },
      update: { plannerRole: a.plannerRole, note: a.note },
      create: a,
    });
  }
  for (const c of CAMPUSES) {
    const division = await prisma.division.findUniqueOrThrow({ where: { name: c.division } });
    const area = await prisma.area.findUniqueOrThrow({ where: { name: c.area } });
    await prisma.campus.upsert({
      where: { name: c.name },
      update: { divisionId: division.id, areaId: area.id },
      create: { name: c.name, divisionId: division.id, areaId: area.id },
    });
  }
  for (const [campusName, byMonth] of Object.entries(CHUTOBU_ENROLLMENT_DRAFT)) {
    const campus = await prisma.campus.findUniqueOrThrow({ where: { name: campusName } });
    for (const [yearMonth, count] of Object.entries(byMonth)) {
      await prisma.enrollment.upsert({
        where: { campusId_yearMonth: { campusId: campus.id, yearMonth } },
        update: { count, draft: true },
        create: { campusId: campus.id, yearMonth, count, draft: true },
      });
    }
  }
  console.log("seed 完了: 職員", STAFF.length, "/ 部門", DIVISIONS.length, "/ 地区", AREAS.length, "/ 拠点", CAMPUSES.length);
  console.log(`初期ログイン: ${STAFF.map((s) => s.email).join(", ")} / パスワード= ${SEED_PASSWORD}（必ず変更してください）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
