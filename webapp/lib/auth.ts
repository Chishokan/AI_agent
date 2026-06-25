import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export async function verifyCredentials(email: string, password: string) {
  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) return null;
  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return null;
  return { id: staff.id, name: staff.name, role: staff.role, email: staff.email };
}

export async function getStaff(id: number | null) {
  if (id == null) return null;
  return prisma.staff.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, email: true },
  });
}
