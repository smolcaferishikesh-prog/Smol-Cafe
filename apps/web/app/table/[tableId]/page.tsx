import TableEntryPage from "@/app/t/[tableToken]/page";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export const metadata = {
  title: "Table Service — smol café",
  description: "Direct customer ordering interface for your table at smol café.",
};

export default async function TableDirectRoutePage({ params }: PageProps) {
  const { tableId } = await params;
  return <TableEntryPage params={Promise.resolve({ tableToken: tableId })} />;
}
