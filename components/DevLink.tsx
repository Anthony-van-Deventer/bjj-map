import Link from "next/link";

export const IS_DEV = process.env.NODE_ENV === "development";

export function DevLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!IS_DEV) return null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-400 hover:text-white"
    >
      ✎ {children}
    </Link>
  );
}
