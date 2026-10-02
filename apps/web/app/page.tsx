import { StaffBackdoorPortal } from "@/components/staff/StaffBackdoorPortal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SMOL Backdoor — smol café",
  description: "Secure role-based backdoor login for Admin, Kitchen KDS, Cashier, and Barista staff.",
};

export default function RootPage() {
  return <StaffBackdoorPortal />;
}
