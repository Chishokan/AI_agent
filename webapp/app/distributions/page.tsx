import { prisma } from "@/lib/prisma";
import { currentStaffId } from "@/lib/session";
import { redirect } from "next/navigation";
import DistributionsUI from "./ui";

export const dynamic = "force-dynamic";

export default async function DistributionsPage() {
  if (currentStaffId() == null) redirect("/login");
  const [areas, targetSchools] = await Promise.all([
    prisma.area.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
    prisma.targetSchool.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, areaId: true } }),
  ]);
  return <DistributionsUI areas={areas} targetSchools={targetSchools} />;
}
