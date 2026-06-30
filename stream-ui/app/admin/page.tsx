import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listStreams } from "@/lib/streams";
import { StreamManager } from "@/components/admin/stream-manager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StreamManager initialStreams={listStreams()} />
    </div>
  );
}
