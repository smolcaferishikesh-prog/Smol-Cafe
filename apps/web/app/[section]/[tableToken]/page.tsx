import TableEntryPage from "@/app/t/[tableToken]/page";

interface PageProps {
  params: Promise<{ section: string; tableToken: string }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Table Service — smol café",
  description: "Direct customer ordering interface for your table at smol café.",
};

export default async function SectionTableRoutePage({ params }: PageProps) {
  const { tableToken } = await params;
  return <TableEntryPage params={Promise.resolve({ tableToken })} />;
}
