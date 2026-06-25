import bcrypt from "bcryptjs";
import { get } from "./db";

type StaffRow = { id: number; name: string; role: string; email: string; passwordHash: string };

export async function verifyCredentials(email: string, password: string) {
  const staff = get<StaffRow>("SELECT id,name,role,email,passwordHash FROM Staff WHERE email=?", email);
  if (!staff) return null;
  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return null;
  return { id: staff.id, name: staff.name, role: staff.role, email: staff.email };
}

export function getStaff(id: number | null) {
  if (id == null) return null;
  return get<{ id: number; name: string; role: string; email: string }>(
    "SELECT id,name,role,email FROM Staff WHERE id=?",
    id,
  ) ?? null;
}
