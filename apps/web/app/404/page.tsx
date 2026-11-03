import NotFound from "@/app/not-found";

export const metadata = {
  title: "404 — Table Not Found · smol café",
  description: "The table or page you are looking for does not exist. Return to smol café Rishikesh.",
};

export default function Custom404Page() {
  return <NotFound />;
}

