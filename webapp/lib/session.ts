import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "nep_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";

function sign(staffId: number): string {
  const payload = String(staffId);
  const mac = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

/** Cookie値を検証し staffId を返す。改ざん/不正なら null。 */
export function verify(value: string | undefined): number | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const id = Number(payload);
  return Number.isInteger(id) ? id : null;
}

export const sessionCookie = {
  name: COOKIE,
  build(staffId: number) {
    return {
      name: COOKIE,
      value: sign(staffId),
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12, // 12時間
    };
  },
  clear() {
    return { name: COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 };
  },
};

/** サーバーコンポーネント/Route Handler から現在の staffId を取得。 */
export function currentStaffId(): number | null {
  return verify(cookies().get(COOKIE)?.value);
}
