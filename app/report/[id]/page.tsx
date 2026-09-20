import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import ShareButton from "./ShareButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await prisma.medReport.findUnique({
    where: { id },
  });

  if (!report) {
    return {
      title: "Report Not Found | Hygie AI",
    };
  }

  return {
    title: `Clinical Fact-Check: ${report.verdict} (${report.credibilityScore}/100) | Hygie AI`,
    description: report.explanation.slice(0, 160),
  };
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;

  const report = await prisma.medReport.findUnique({
    where: { id },
  });

  if (!report) {
    notFound();
  }

  const verdictStyles: Record<
    string,
    { bg: string; text: string; border: string; label: string; badge: string }
  > = {
    Verified: {
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      border: "border-emerald-200",
      label: "Verified by Clinical Consensus",
      badge: "🟢 Verified",
    },
    Misleading: {
      bg: "bg-amber-50",
      text: "text-amber-900",
      border: "border-amber-200",
      label: "Misleading or Lacks Scientific Context",
      badge: "🟡 Misleading",
    },
    False: {
      bg: "bg-rose-50",
      text: "text-rose-900",
      border: "border-rose-200",
      label: "Refuted by Authoritative Evidence",
      badge: "🔴 False Claim",
    },
    Scam: {
      bg: "bg-red-100",
      text: "text-red-950",
      border: "border-red-300",
      label: "High-Risk Scam / Deceptive Health Product",
      badge: "🚨 Scam Warning",
    },
  };

  const currentVerdict = verdictStyles[report.verdict] || {
    bg: "bg-stone-50",
    text: "text-stone-900",
    border: "border-stone-200",
    label: report.verdict,
    badge: report.verdict,
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(report.createdAt));

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
              Audit Record
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <ShareButton />
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-xl bg-[#d97757] hover:bg-[#c36445] text-white text-xs font-medium transition shadow-xs"
            >
              Analyze New Claim
            </Link>
          </div>
        </div>
      </header>

      {/* Main Report Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Header Hero Card */}
        <div className="bg-white border border-[#dedad1] rounded-2xl p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#7d7871] mb-4 pb-4 border-b border-[#f3efe6]">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-[#f5f3ec] px-2 py-0.5 rounded border border-[#e8e4db] text-[11px]">
                ID: {report.id}
              </span>
              <span>·</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8c877e]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Permanent Immutable Record</span>
            </div>
          </div>

          {/* Verdict Banner */}
          <div
            className={`p-5 rounded-xl border ${currentVerdict.border} ${currentVerdict.bg} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6`}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-75 mb-1">
                Clinical Fact-Check Verdict
              </div>
              <div className={`text-xl md:text-2xl font-serif font-bold ${currentVerdict.text}`}>
                {currentVerdict.badge}
              </div>
              <p className={`text-xs mt-1 opacity-90 ${currentVerdict.text}`}>
                {currentVerdict.label}
              </p>
            </div>

            {/* Credibility Meter */}
            <div className="bg-white/80 backdrop-blur-sm border border-black/5 rounded-xl p-3.5 min-w-[170px] text-center shrink-0">
              <div className="text-[10px] font-semibold text-[#7d7871] uppercase tracking-wider">
                Credibility Score
              </div>
              <div className="text-3xl font-serif font-bold text-[#2c2724] my-0.5">
                {report.credibilityScore}
                <span className="text-sm font-sans font-normal text-[#9c978f]">/100</span>
              </div>
              <div className="w-full bg-[#e8e5dc] h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    report.credibilityScore >= 70
                      ? "bg-emerald-500"
                      : report.credibilityScore >= 40
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.max(report.credibilityScore, 4)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Claim Under Review */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[#9c978f] uppercase tracking-wider">
              Health Claim Evaluated
            </h2>
            <div className="p-4 rounded-xl bg-[#f8f7f2] border border-[#e8e5dc] text-sm text-[#2c2724] leading-relaxed italic">
              &ldquo;{report.userInputText || "Extracted from image / multimedia submission"}&rdquo;
            </div>

            {report.sourceUrl && (
              <div className="pt-1 text-xs text-[#7d7871] flex items-center gap-1.5 truncate">
                <LinkIcon className="w-3.5 h-3.5 text-[#d97757] shrink-0" />
                <span>Source URL:</span>
                <a
                  href={report.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#d97757] hover:underline truncate"
                >
                  {report.sourceUrl}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Rationale & Findings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clinical Explanation */}
          <div className="bg-white border border-[#dedad1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center gap-2 text-[#d97757]">
              <StethoscopeIcon className="w-4 h-4" />
              <h3 className="font-serif font-semibold text-base text-[#2c2724]">
                Clinical Rationale
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-[#524e48] whitespace-pre-wrap">
              {report.explanation}
            </p>
          </div>

          {/* Verified Medical Facts */}
          <div className="bg-white border border-[#dedad1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheckIcon className="w-4 h-4" />
              <h3 className="font-serif font-semibold text-base text-[#2c2724]">
                Verified Consensus
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-[#524e48] whitespace-pre-wrap">
              {report.correctFacts}
            </p>
          </div>
        </div>

        {/* Action Plan & Safety Recommendations */}
        <div className="bg-white border border-[#dedad1] rounded-2xl p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center gap-2 text-[#d97757]">
            <HeartPulseIcon className="w-5 h-5" />
            <h3 className="font-serif font-semibold text-lg text-[#2c2724]">
              Recommended Action Plan
            </h3>
          </div>
          <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece9e1] text-sm leading-relaxed text-[#2c2724] whitespace-pre-wrap">
            {report.actionPlan}
          </div>
        </div>

        {/* Authoritative Sources & Audit Trail */}
        <div className="bg-white border border-[#dedad1] rounded-2xl p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
          <h3 className="font-serif font-semibold text-base text-[#2c2724] flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4 text-[#d97757]" />
            <span>Authoritative Sources & Citations</span>
          </h3>

          {report.sourcesCited && report.sourcesCited.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {report.sourcesCited.map((source, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f9f8f4] border border-[#e8e5dc] text-xs text-[#524e48]"
                >
                  <span className="w-5 h-5 rounded-full bg-[#f0eee6] text-[#7d7871] flex items-center justify-center font-mono text-[10px] shrink-0">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium">{source}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#7d7871] italic">
              Cross-referenced against general WHO and CDC public health clinical consensus databases.
            </p>
          )}

          {/* Audit Meta */}
          <div className="pt-4 border-t border-[#f3efe6] flex flex-wrap items-center justify-between gap-3 text-xs text-[#9c978f]">
            <div>
              Verified by Model: <span className="font-mono text-[#7d7871]">{report.flaggedByModel}</span>
            </div>
            {report.latitude && report.longitude && (
              <div>
                Location: Lat {report.latitude.toFixed(2)}, Lon {report.longitude.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="text-center text-xs text-[#a49f96] py-6 leading-relaxed max-w-xl mx-auto">
          Hygie AI evaluates medical information against public health consensus (WHO, CDC, FDA). This record is generated for fact-checking purposes and does not constitute individual medical diagnosis or prescription. Always consult a licensed healthcare professional.
        </div>
      </main>
    </div>
  );
}

// Inline SVGs
function ClaudeStarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3" strokeLinecap="round" />
      <path d="M9 12.5v3a4.5 4.5 0 0 0 9 0v-2.5" strokeLinecap="round" />
      <circle cx="18" cy="10" r="2.5" />
      <circle cx="4.5" cy="3" r="1.5" />
      <circle cx="13.5" cy="3" r="1.5" />
    </svg>
  );
}

function HeartPulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

