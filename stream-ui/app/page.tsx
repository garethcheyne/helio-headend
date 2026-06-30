import { SiteHeader } from "@/components/site-header";
import { ServiceStatus } from "@/components/service-status";
import { ChannelList } from "@/components/channel-list";
import { StreamStats } from "@/components/stream-stats";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Internal monitoring (service IPs, tuner stats) and internal links are
  // admin-only — this dashboard is publicly reachable.
  const admin = await isAuthenticated();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader isAdmin={admin} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Headend Overview</h1>
          <p className="text-sm text-muted-foreground">
            {admin
              ? "Live status of the TVHeadend → HLS pipeline."
              : "Channel lineup."}
          </p>
        </div>

        {admin && <ServiceStatus />}

        <div className={admin ? "grid gap-6 lg:grid-cols-[1fr_360px]" : ""}>
          <ChannelList />
          {admin && <StreamStats />}
        </div>
      </main>
    </div>
  );
}
