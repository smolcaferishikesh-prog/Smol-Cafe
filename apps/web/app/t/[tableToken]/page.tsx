import Image from "next/image";
import { resolveQrToken, clearTableSession, activateTableAndRedirectAction } from "../actions";
import { AlertTriangle, Home } from "lucide-react";
import { TableActionBar } from "@/components/table/TableActionBar";
import { TableGuestOnboardingForm } from "@/components/table/TableGuestOnboardingForm";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tableToken: string }>;
}

function getPlacardFontSize(text: string): string {
  const len = text.length;
  if (len <= 2) {
    return "text-2xl sm:text-3xl font-serif font-bold tracking-tight";
  }
  if (len <= 4) {
    return "text-lg sm:text-xl font-serif font-bold tracking-tight";
  }
  if (len <= 7) {
    return "text-[11px] sm:text-xs font-sans font-black tracking-wide uppercase break-all leading-tight";
  }
  return "text-[9px] sm:text-[10px] font-sans font-black tracking-tight uppercase break-all leading-none";
}

function getDisplayTableNumber(tableLabel?: string, tableToken?: string): string {
  const source = (tableLabel || tableToken || "07").trim();
  if (/^\d+$/.test(source)) {
    return source.padStart(2, "0");
  }
  const match = source.match(/^(?:table|t)[-\s_]*(\d+)$/i);
  if (match) {
    return match[1].padStart(2, "0");
  }
  const cleaned = source.replace(/^(?:table|t)[-\s_]+/i, "").trim();
  return cleaned || source;
}

export default async function TableEntryPage({ params }: PageProps) {
  const { tableToken } = await params;
  const result = await resolveQrToken(tableToken, true);

  // 1. Invalid or Revoked QR Error Screen (Refined smol café brand aesthetic)
  if (!result.success || !result.session) {
    return (
      <div className="relative min-h-[100dvh] flex flex-col justify-between items-center bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] px-4 py-6 transition-colors duration-200 select-none overflow-x-hidden">
        {/* Floating Theme Toggle (Day / Night switch) */}
        <div className="absolute top-4 right-4 z-40">
          <ThemeToggle variant="icon" />
        </div>

        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#B72E35]/10 dark:bg-[#754CFF]/15 blur-3xl" />

        {/* Top Brand Logo */}
        <div className="pt-2 sm:pt-4 flex flex-col items-center z-10">
          <div className="relative transition-transform duration-300 hover:scale-105 flex flex-col items-center">
            <Image
              src="/table-header-logo.png"
              alt="smol café"
              width={112}
              height={164}
              className="w-16 sm:w-20 h-auto object-contain select-none dark:hidden animate-logo-moving-light drop-shadow-[0_6px_12px_rgba(114,80,57,0.15)]"
              priority
            />
            <Image
              src="/table-header-logo-dark.png?v=6"
              alt="smol café"
              width={198}
              height={244}
              className="w-16 sm:w-20 h-auto object-contain select-none hidden dark:block animate-logo-moving-dark"
              priority
            />
          </div>
        </div>

        {/* Center Error Card */}
        <div className="w-full max-w-sm rounded-[2rem] border border-[#C9AE8B]/40 dark:border-white/10 bg-[#FAF4EB]/95 dark:bg-[#1C1715]/95 backdrop-blur-xl p-6 sm:p-8 text-center shadow-2xl shadow-[#725039]/10 dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto relative overflow-hidden z-10">
          {/* Top highlight bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#B72E35] dark:via-[#F2C84B] to-transparent opacity-80" />

          {/* Warning Icon Badge */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#B72E35]/10 dark:bg-[#F2C84B]/15 border border-[#B72E35]/20 dark:border-[#F2C84B]/25">
            <AlertTriangle className="h-8 w-8 text-[#B72E35] dark:text-[#F2C84B]" />
          </div>

          {/* Heading */}
          <h1 className="font-serif text-2xl sm:text-[1.65rem] font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] leading-tight">
            This QR isn&apos;t working, please call staff
          </h1>

          {/* Subtitle Message */}
          <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#725039] dark:text-[#C9AE8B] font-sans">
            {result.message ||
              "This table does not exist or has been removed. Please wave to a team member or ask at the counter."}
          </p>

          {/* Token chip */}
          <div className="mt-6 rounded-xl border border-[#C9AE8B]/40 dark:border-white/10 bg-[#F3E7D3]/60 dark:bg-[#151110] px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="font-mono text-[#725039] dark:text-[#C9AE8B]">Scanned Token</span>
            <span className="font-mono font-bold text-[#241F1C] dark:text-[#FAF4EB] bg-[#FAF4EB] dark:bg-[#2A2420] px-2.5 py-0.5 rounded-md border border-[#C9AE8B]/30 dark:border-white/5">
              {tableToken}
            </span>
          </div>

          {/* Primary Action Button: Redirects to / (http://localhost:3000/) */}
          <form action={clearTableSession} className="mt-6">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#241F1C] hover:bg-[#1D1815] dark:bg-[#FAF4EB] dark:hover:bg-white py-3.5 px-5 text-sm font-bold text-[#FAF4EB] dark:text-[#241F1C] shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              <Home className="h-4 w-4" />
              <span>Back to Home</span>
            </button>
          </form>
        </div>

        {/* Footer Brand Tagline */}
        <div className="pt-4 pb-2 text-center text-[#725039]/70 dark:text-[#C9AE8B]/60 font-mono text-[11px] tracking-wide uppercase z-10">
          <p>smol café · good coffee · brighter days</p>
          <p className="text-[10px] opacity-75 mt-0.5">tapovan, rishikesh</p>
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
    <div className="relative min-h-[100dvh] h-[100dvh] max-h-[100dvh] bg-[#F3E7D3] dark:bg-[#151110] text-[#241F1C] dark:text-[#FAF4EB] flex flex-col justify-between items-center px-4 py-2 sm:py-3 transition-colors duration-200 select-none overflow-y-auto sm:overflow-hidden">
      {/* Floating Theme Toggle (Day / Night switch) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-40">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-xs sm:max-w-sm flex flex-col items-center flex-1 justify-center space-y-1.5 sm:space-y-2.5 my-auto">
        {/* Top Brand Door Logo & Tagline with Dynamic Moving Animations */}
        <div className="flex flex-col items-center">
          <div className="relative transition-transform duration-300 hover:scale-105 cursor-pointer flex flex-col items-center">
            {/* Day Mode Logo: Clean Arched Red Door with Gentle Floating Bob */}
            <Image
              src="/table-header-logo.png"
              alt="smol café - Good Coffee Brighter Days"
              width={112}
              height={164}
              className="w-16 sm:w-20 md:w-22 h-auto object-contain select-none dark:hidden animate-logo-moving-light drop-shadow-[0_6px_12px_rgba(114,80,57,0.15)]"
              priority
            />
            {/* Night Mode Logo: Glowing Neon Violet Door & Tagline with Moving Levitation + Breathing Neon Glow */}
            <Image
              src="/table-header-logo-dark.png?v=6"
              alt="smol café - Good Company Brighter Days"
              width={198}
              height={244}
              className="w-16 sm:w-20 md:w-22 h-auto object-contain select-none hidden dark:block animate-logo-moving-dark"
              priority
            />
          </div>
        </div>

        {/* Hand-drawn Architectural Door Illustration on Transparent Cutout */}
        <div className="relative w-full max-w-[190px] sm:max-w-[220px] md:max-w-[240px] mx-auto">
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
            className="w-full h-auto object-contain select-none pointer-events-none hidden dark:block drop-shadow-[0_0_20px_rgba(117,76,255,0.22)]"
            priority
          />

          {/* Day Mode Dynamic Table Placard overlay for ALL tables */}
          <div
            className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none dark:hidden px-1 overflow-hidden"
            style={{
              top: "50%",
              left: "40.2%",
              transform: "translate(-50%, -50%)",
              width: "24%",
              height: "28%",
            }}
          >
            <span className="text-[7.5px] sm:text-[8.5px] font-sans font-bold tracking-[0.16em] text-[#241F1C]/75 uppercase mb-0.5">
              TABLE
            </span>
            <span
              className={`text-[#241F1C] max-w-full px-0.5 line-clamp-2 ${getPlacardFontSize(
                displayTableNumber
              )}`}
              title={displayTableNumber}
            >
              {displayTableNumber}
            </span>
          </div>

          {/* Night Mode Dynamic Placard overlay for ALL tables */}
          <div
            className="absolute hidden dark:flex flex-col items-center justify-center text-center pointer-events-none select-none px-1 overflow-hidden"
            style={{
              top: "56.9%",
              left: "42.2%",
              transform: "translate(-50%, -50%)",
              width: "22%",
              height: "30%",
            }}
          >
            <span className="text-[7.5px] sm:text-[8.5px] font-sans font-bold tracking-[0.16em] text-[#C4B5FD] uppercase drop-shadow-[0_0_8px_rgba(196,181,253,0.6)] mb-0.5">
              TABLE
            </span>
            <span
              className={`text-[#E9D5FF] max-w-full px-0.5 drop-shadow-[0_0_12px_rgba(233,213,255,0.85)] line-clamp-2 ${getPlacardFontSize(
                displayTableNumber
              )}`}
              title={displayTableNumber}
            >
              {displayTableNumber}
            </span>
          </div>
        </div>

        {/* Headline: EB Garamond, espresso ink + smol cherry (#B72E35) */}
        <div className="text-center pt-0 px-2 max-w-xs mx-auto">
          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#241F1C] dark:text-[#FAF4EB] leading-tight break-words">
            You&apos;re at{" "}
            <span className="text-[#B72E35] dark:text-[#F2C84B] font-extrabold">
              {displayTableNumber.toLowerCase().startsWith("table")
                ? displayTableNumber
                : `Table ${displayTableNumber}`}
            </span>
          </h1>
        </div>

        {/* Coffee Bean Divider */}
        <div className="flex items-center justify-center my-0.5">
          <Image
            src="/table-bean-divider.png"
            alt="coffee bean divider"
            width={162}
            height={31}
            className="h-2.5 sm:h-3 w-auto object-contain select-none dark:invert opacity-90"
            priority
          />
        </div>

        {/* Poetic Subtitle in walnut (#725039) per brand kit */}
        <div className="text-[#725039] dark:text-[#C9AE8B] font-mono text-[11px] sm:text-xs leading-tight space-y-0.5 text-center">
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
