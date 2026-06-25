import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { currentStaffId } from "@/lib/session";
import { hasClaude } from "@/lib/claude";
import AgentUI from "./ui";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  if (currentStaffId() == null) redirect("/login");
  const areas = all<{ id: number; name: string }>("SELECT id, name FROM Area ORDER BY id");
  return <AgentUI areas={areas} claudeEnabled={hasClaude()} />;
}
