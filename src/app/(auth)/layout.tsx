export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="soft-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-10 before:absolute before:-right-32 before:-top-32 before:h-96 before:w-96 before:rounded-full before:bg-primary/10 before:blur-3xl after:absolute after:-bottom-40 after:-left-24 after:h-96 after:w-96 after:rounded-full after:bg-blue-400/10 after:blur-3xl">
      {children}
    </main>
  );
}
