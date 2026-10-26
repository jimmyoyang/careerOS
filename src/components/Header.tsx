"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PanelLeft, Briefcase, Search } from "lucide-react";

import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SIDEBAR_LINKS } from "@/lib/constants";
import SidebarToggle from "./SidebarToggle";
import { AgentChatTrigger } from "./AgentChatTrigger";

function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/dashboard/search?q=${encodeURIComponent(value)}` : "/dashboard/search");
  };

  return (
    <header className="sticky top-0 z-30 mx-3 mt-3 flex h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-3 shadow-sm backdrop-blur-xl sm:static sm:mx-4 sm:mt-4 sm:h-16 sm:px-4 lg:mx-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="rounded-xl sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">展开导航</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <nav className="grid gap-6 text-lg font-medium">
            <SheetClose asChild>
              <Link
                href="/dashboard"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              >
                <Briefcase className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">CareerOS</span>
              </Link>
            </SheetClose>
            {SIDEBAR_LINKS.map((item) => {
              // Only show dev-only items in development mode
              if (item.devOnly && process.env.NODE_ENV !== "development") {
                return null;
              }
              return (
                <SheetClose asChild key={item.label}>
                  <Link
                    href={item.route}
                    className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <SidebarToggle />
      <Link href="/dashboard" className="shrink-0 text-sm font-semibold tracking-tight sm:text-base">CareerOS<span className="hidden xl:inline text-muted-foreground"> · 招聘工作台</span></Link>
      <form onSubmit={submitSearch} className="relative ml-auto hidden w-full max-w-sm md:block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          id="global-job-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索职位、公司或技能"
          aria-label="搜索职位、公司或技能"
          className="h-10 w-full rounded-xl border-border/70 bg-muted/60 pl-9 pr-3 text-sm outline-none ring-offset-background transition focus:bg-background focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
      <Link href="/dashboard/search" className="ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted md:hidden"><Search className="h-4 w-4" /><span className="sr-only">职位搜索</span></Link>

      <AgentChatTrigger />
    </header>
  );
}

export default Header;
