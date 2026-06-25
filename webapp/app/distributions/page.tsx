import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { currentStaffId } from "@/lib/session";
import DistributionsUI from "./ui";

export const dynamic = "force-dynamic";

export default async function DistributionsPage() {
  if (currentStaffId() == null) redirect("/login");
  const areas = all<{ id: number; name: string }>("SELECT id, name FROM Area ORDER BY id");
  const targetSchools = all<{ id: number; name: string; areaId: number | null }>(
    "SELECT id, name, areaId FROM TargetSchool ORDER BY name",
  );
  return <DistributionsUI areas={areas} targetSchools={targetSchools} />;
}
