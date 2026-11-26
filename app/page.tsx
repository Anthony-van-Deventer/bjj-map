import { Explorer } from "@/components/Explorer";
import { getContent } from "@/lib/content";

export default function Home() {
  return <Explorer content={getContent()} />;
}
