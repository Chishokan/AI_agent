import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { currentStaffId } from "@/lib/session";
import EnrollmentUI from "./ui";

export const dynamic = "force-dynamic";

export default async function EnrollmentPage() {
  if (currentStaffId() == null) redirect("/login");
  const campuses = all<{ id: number; name: string; divisionName: string; areaName: string }>(
    `SELECT c.id, c.name, d.name AS divisionName, a.name AS areaName
       FROM Campus c JOIN Division d ON d.id = c.divisionId JOIN Area a ON a.id = c.areaId
       ORDER BY a.id, c.id`,
  );
  return <EnrollmentUI campuses={campuses} />;
}
