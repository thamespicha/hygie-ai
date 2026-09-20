import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportsIndexPage() {
  const recentReports = await prisma.medReport.findMany({
    take: 12,
    orderBy: { createdAt: "desc" },
  });

  async function handleSearch(formData: FormData) {
    "use server";
    const query = formData.get("reportId")?.toString().trim();
    if (query) {
      redirect(`/report/${query}`);
    }
  }

  const verdictBadge: Record<string, string> = {
    Verified: "🟢 Verified",
    Misleading: "🟡 Misleading",
    False: "🔴 False",
    Scam: "🚨 Scam",
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c2724] font-sans antialiased selection:bg-[#f0dcd3] selection:text-[#913b1f]">
      {/* Top Navbar */}
      <header className="border-b border-[#ece9e1] bg-[#faf9f5]/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/chat"
            className="flex items-center gap-2 text-sm font-serif font-medium text-[#2c2724] hover:opacity-80 transition"
          >
            <ClaudeStarIcon className="w-5 h-5 text-[#d97757]" />
            <span>Hygie AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0eee6] text-[#7d7871] font-sans font-normal ml-1">
              Public Registry
            </span>
          </Link>

          <Link
            href="/chat"
            className="px-3 py-1.5 rounded-xl bg-[#d97757] hover:bg-[#c36445] text-white text-xs font-medium transition shadow-xs"
          >
            Start New Audit
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* Hero title & Search */}
        <div className="text-center max-w-xl mx-auto space-y-3">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-[#2c2724]">
            Clinical Fact-Check Registry
          </h1>
          <p className="text-sm text-[#7d7871] leading-relaxed">
            Search or browse permanent verifiable medical audit records evaluated by Hygie AI against authoritative health consensus.
          </p>

          {/* Search by Report ID Form */}
          <form action={handleSearch} className="pt-3 flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              name="reportId"
              placeholder="Enter Report ID (e.g. 3ba1...)"
              required
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#dedad1] focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] text-xs outline-none shadow-2xs"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#2c2724] hover:bg-black text-white text-xs font-medium transition cursor-pointer shadow-2xs"
            >
              Lookup
            </button>
          </form>
        </div>

        {/* Recent Reports Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#9c978f] uppercase tracking-wider">
              Recently Audited Claims ({recentReports.length})
            </h2>
          </div>

          {recentReports.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-[#dedad1] text-sm text-[#7d7871]">
              No reports found in the registry yet. Start your first fact-check from the chat!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/report/${report.id}`}
                  className="p-5 rounded-2xl bg-white border border-[#dedad1] hover:border-[#cbc6bb] hover:shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-xs text-[#2c2724]">
                        {verdictBadge[report.verdict] || report.verdict}
                      </span>
                      <span className="text-[11px] font-mono text-[#8f8a81] bg-[#f7f6f2] px-2 py-0.5 rounded border border-[#e8e4dc]">
                        Score: {report.credibilityScore}/100
                      </span>
                    </div>

                    <p className="text-xs text-[#524e48] line-clamp-3 leading-relaxed">
                      &ldquo;{report.userInputText || report.explanation}&rdquo;
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#f5f3ec] flex items-center justify-between text-[11px] text-[#9c978f]">
                    <span className="font-mono truncate max-w-[140px]">
                      #{report.id.slice(0, 8)}...
                    </span>
                    <span className="group-hover:text-[#d97757] transition font-medium">
                      View Report →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ClaudeStarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" />
    </svg>
  );
}

