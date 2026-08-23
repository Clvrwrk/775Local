import { Link, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, Mail, Search, UserRound } from "lucide-react";
import { CircleMark } from "@/components/brand/mark";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-9 animate-pulse rounded-full bg-paper-2" />;
  }
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/account"
          className="hidden h-10 items-center rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-paper-2 sm:inline-flex"
        >
          Account
        </Link>
        <UserButton />
      </div>
    );
  }
  return (
    <SignedOut>
      <Link
        to="/login"
        search={{ next: "/account" }}
        className="inline-flex h-10 items-center rounded-full bg-gold px-4 text-sm font-medium text-ink hover:bg-gold-2"
      >
        Sign in
      </Link>
    </SignedOut>
  );
}

function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
      active ? "text-gold" : "text-paper/70",
    );
  const explore =
    pathname === "/" ||
    pathname.startsWith("/nv") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/cities") ||
    pathname.startsWith("/biz");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pine pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-4">
        <Link to="/" className={itemClass(explore)}>
          <Search className="size-5" strokeWidth={1.75} />
          Explore
        </Link>
        <Link to="/register" className={itemClass(pathname.startsWith("/register"))}>
          <Mail className="size-5" strokeWidth={1.75} />
          Mail
        </Link>
        <Link
          to="/claim"
          search={{ q: "", city: "" }}
          className={itemClass(pathname.startsWith("/claim") || pathname.startsWith("/list-your-business"))}
        >
          <BadgeCheck className="size-5" strokeWidth={1.75} />
          Claim
        </Link>
        <Link
          to="/account"
          className={itemClass(pathname.startsWith("/account") || pathname.startsWith("/login"))}
        >
          <UserRound className="size-5" strokeWidth={1.75} />
          Account
        </Link>
      </div>
    </nav>
  );
}

export function SiteShell({
  children,
  wash = false,
}: {
  children: React.ReactNode;
  wash?: boolean;
}) {
  return (
    <div className={cn("min-h-dvh text-ink", wash ? "topo-wash" : "bg-paper")}>
      <header className="sticky top-0 z-30 bg-paper/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-gold">
            <CircleMark className="size-8" />
            <span className="font-display text-2xl font-semibold tracking-tight text-ink">
              775
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/cities" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2">
              Towns
            </Link>
            <Link to="/categories" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2">
              Services
            </Link>
            <Link to="/list-your-business" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2">
              List your business
            </Link>
            <Link to="/register" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2">
              Local mail
            </Link>
          </nav>
          <AuthSlot />
        </div>
      </header>
      <main className="pb-20 md:pb-0">{children}</main>
      <footer className="mt-8 hidden border-t border-line md:block">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-display text-xl font-semibold">
              <span className="text-gold"><CircleMark className="size-6" /></span>
              775 Directory
            </p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              The local business finder for Northern Nevada — California border to the Utah line.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-ink">Find</p>
            <div className="mt-2 flex flex-col gap-1.5 text-ink-soft">
              <Link to="/cities">Towns in the 775</Link>
              <Link to="/categories">Services</Link>
              <Link to="/nv/$city/$category" params={{ city: "reno", category: "screen-repair" }}>
                Screen repair in Reno
              </Link>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-medium text-ink">Directory</p>
            <div className="mt-2 flex flex-col gap-1.5 text-ink-soft">
              <Link to="/offers">Offers</Link>
              <Link to="/claim" search={{ q: "", city: "" }}>Claim a listing</Link>
              <Link to="/about">About</Link>
              <Link to="/spec">PRD & schema</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
        </div>
        <p className="border-t border-line px-4 py-4 text-center text-xs text-muted">
          Not a newspaper. A directory for the better half of Nevada.
        </p>
      </footer>
      <TabBar />
    </div>
  );
}
