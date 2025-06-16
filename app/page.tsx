import MetricsCards from "@/components/metrics-cards"
import NotificationsPanel from "@/components/notifications-panel"
import PoTable from "@/components/po-table"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Purchase Order Dashboard</h1>
        </div>
        <div>
          <NotificationsPanel />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <MetricsCards />
        <PoTable />
      </main>
    </div>
  )
}
