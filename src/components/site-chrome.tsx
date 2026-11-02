export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-x-clip">{children}</main>
  );
}
