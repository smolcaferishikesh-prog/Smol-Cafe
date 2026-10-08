import Image from "next/image";
import { resolveQrToken, clearTableSession, activateTableAndRedirectAction, fetchActiveTablesAction } from "../actions";
import { AlertTriangle } from "lucide-react";
import { TableActionBar } from "@/components/table/TableActionBar";
import { TableGuestOnboardingForm } from "@/components/table/TableGuestOnboardingForm";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tableToken: string }>;
}

function getDisplayTableNumber(tableLabel?: string, tableToken?: string): string {
  const source = tableLabel || tableToken || "07";
  const match = source.match(/\d+/);
  if (match) {
    return match[0].padStart(2, "0");
  }
  return source.replace(/^(table|t)[-\s_]*/i, "").trim().toUpperCase() || "07";
}

export default async function TableEntryPage({ params }: PageProps) {
  const { tableToken } = await params;
  const result = await resolveQrToken(tableToken, true);

  // 1. Invalid or Revoked QR Error Screen (Strictly on-brand colors)
  if (!result.success || !result.session) {
    const activeTables = await fetchActiveTablesAction().catch(() => []);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3E7D3] dark:bg-[#241F1C] px-6 py-12 text-[#241F1C] dark:text-[#F3E7D3]">
        <div className="w-full max-w-md rounded-3xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB] dark:bg-[#2A2420] p-8 text-center shadow-lg backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2C84B]/20 dark:bg-[#F2C84B]/10">
            <AlertTriangle className="h-8 w-8 text-[#B72E35] dark:text-[#F2C84B]" />
          </div>

          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#F3E7D3]">
            This QR isn&apos;t working, please call staff
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-[#725039] dark:text-[#C9AE8B] font-sans">
            {result.message ||
              "We couldn&apos;t connect this QR code to an active table session. Please wave to a team member or ask at the counter."}
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/60 dark:bg-[#1C1715] p-3.5 text-xs text-[#725039] dark:text-[#C9AE8B] font-mono">
              Token:{" "}
              <span className="font-mono text-[#241F1C] dark:text-[#F3E7D3] font-bold">{tableToken}</span>
            </div>

            {activeTables.length > 0 && (
              <div className="space-y-2 text-center pt-2">
                <p className="text-xs font-semibold text-[#725039] dark:text-[#C9AE8B]">
                  Or select your table:
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-h-36 overflow-y-auto">
                  {activeTables.map((t) => (
                    <a
                      key={t.label}
                      href={`/t/table-${t.label}`}
                      className="rounded-lg border border-[#C9AE8B]/60 bg-white dark:bg-[#1C1715] px-2.5 py-1 text-xs font-bold text-[#241F1C] dark:text-[#F3E7D3] hover:bg-[#B72E35] hover:text-white transition"
                    >
                      Table {t.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <form action={clearTableSession}>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#241F1C] py-3.5 text-sm font-semibold text-[#F3E7D3] shadow-sm transition hover:bg-[#1D1815] active:scale-[0.99] dark:bg-[#F3E7D3] dark:text-[#241F1C] dark:hover:bg-[#FAF4EB] cursor-pointer"
              >
                Back to Home
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const { tableLabel } = result.session;
  const displayTableNumber = getDisplayTableNumber(tableLabel, tableToken);

  // 2. Exact Brand Kit Palette:
  // - café crème: #F3E7D3
  // - smol cherry: #B72E35
  // - espresso ink: #241F1C
  // - walnut: #725039
  // - biscuit: #C9AE8B
  return (
    <div className="relative min-h-screen bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] flex flex-col justify-between items-center px-6 py-6 sm:py-8 transition-colors duration-200 select-none">
      {/* Floating Theme Toggle (Day / Night switch) */}
      <div className="absolute top-4 right-4 z-40">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-sm flex flex-col items-center flex-1 justify-center space-y-3 sm:space-y-4">
        {/* Top Brand Door Logo & Tagline with Dynamic Moving Animations */}
        <div className="pt-2 sm:pt-4 flex flex-col items-center">
          <div className="relative transition-transform duration-300 hover:scale-105 cursor-pointer flex flex-col items-center">
            {/* Day Mode Logo: Clean Arched Red Door with Gentle Floating Bob */}
            <Image
              src="/table-header-logo.png"
              alt="smol café - Good Coffee Brighter Days"
              width={112}
              height={164}
              className="w-24 sm:w-28 h-auto object-contain select-none dark:hidden animate-logo-moving-light drop-shadow-[0_8px_16px_rgba(114,80,57,0.18)]"
              priority
            />
            {/* Night Mode Logo: Glowing Neon Violet Door & Tagline with Moving Levitation + Breathing Neon Glow */}
            <Image
              src="/table-header-logo-dark.png?v=6"
              alt="smol café - Good Company Brighter Days"
              width={198}
              height={244}
              className="w-24 sm:w-28 h-auto object-contain select-none hidden dark:block animate-logo-moving-dark"
              priority
            />
          </div>
        </div>

        {/* Hand-drawn Architectural Door Illustration on Transparent Cutout */}
        <div className="relative w-full max-w-[340px] sm:max-w-[370px] mx-auto">
          {/* Day Mode Gate (Clean Architectural Door Cutout) */}
          <Image
            src="/table-door-blank-transparent.png?v=8"
            alt={`Table ${displayTableNumber}`}
            width={384}
            height={322}
            className="w-full h-auto object-contain select-none pointer-events-none dark:hidden"
            priority
          />
          {/* Night Mode Gate (Clean Glowing Neon Violet & Obsidian Door Cutout) */}
          <Image
            src="/table-door-blank-purple.png?v=8"
            alt={`Table ${displayTableNumber}`}
            width={592}
            height={588}
            className="w-full h-auto object-contain select-none pointer-events-none hidden dark:block drop-shadow-[0_0_24px_rgba(117,76,255,0.25)]"
            priority
          />

          {/* Day Mode Dynamic Table Placard overlay for ALL tables */}
          <div
            className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none dark:hidden"
            style={{
              top: "50%",
              left: "40.2%",
              transform: "translate(-50%, -50%)",
              width: "22%",
              height: "28%",
            }}
          >
            <span className="text-[10px] sm:text-[11px] font-sans font-semibold tracking-[0.16em] text-[#241F1C] uppercase">
              TABLE
            </span>
            <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#241F1C] leading-none mt-1">
              {displayTableNumber}
            </span>
          </div>

          {/* Night Mode Dynamic Placard overlay for ALL tables */}
          <div
            className="absolute hidden dark:flex flex-col items-center justify-center text-center pointer-events-none select-none"
            style={{
              top: "56.9%",
              left: "42.2%",
              transform: "translate(-50%, -50%)",
              width: "20%",
              height: "30%",
            }}
          >
            <span className="text-[10px] sm:text-[11px] font-sans font-semibold tracking-[0.18em] text-[#C4B5FD] uppercase drop-shadow-[0_0_8px_rgba(196,181,253,0.6)]">
              TABLE
            </span>
            <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#E9D5FF] leading-none mt-1 drop-shadow-[0_0_12px_rgba(233,213,255,0.85)]">
              {displayTableNumber}
            </span>
          </div>
        </div>

        {/* Headline: EB Garamond, espresso ink + smol cherry (#B72E35) */}
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] pt-1">
          You&apos;re at <span className="text-[#B72E35] dark:text-[#F2C84B]">Table {displayTableNumber}</span>
        </h1>

        {/* Coffee Bean Divider */}
        <div className="flex items-center justify-center my-1.5">
          <Image
            src="/table-bean-divider.png"
            alt="coffee bean divider"
            width={162}
            height={31}
            className="h-3.5 sm:h-4 w-auto object-contain select-none dark:invert opacity-90"
            priority
          />
        </div>

        {/* Poetic Subtitle in walnut (#725039) per brand kit */}
        <div className="text-[#725039] dark:text-[#C9AE8B] font-mono text-xs sm:text-sm leading-relaxed space-y-0.5 text-center">
          <p>We&apos;ve got your table.</p>
          <p>Scan, sip &amp; stay awhile.</p>
        </div>

        {/* Onboarding Flow: Name & Phone Number -> Navigates to /home */}
        <TableGuestOnboardingForm
          tableToken={tableToken}
          tableLabel={displayTableNumber}
          initialGuestName={result.session?.guestName || ""}
          initialGuestPhone={result.session?.guestPhone || ""}
        />
      </div>

      {/* Interactive Bottom Actions: NEED HELP? | CALL STAFF */}
      <TableActionBar tableNumber={displayTableNumber} />
    </div>
  );
}
