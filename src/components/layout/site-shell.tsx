import { Link, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, Grid2X2, Search, MapPin } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand/logo";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="size-9 animate-pulse rounded-full bg-paper-2" />;
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
        search={{ next: "/account", error: undefined }}
        className="inline-flex h-10 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-gold-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
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
      "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold",
      active ? "text-gold" : "text-paper/70",
    );
  const explore = pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/biz");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pine pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4">
        <Link to="/" className={itemClass(explore)}>
          <Search className="size-5" strokeWidth={1.75} />
          Explore
        </Link>
        <Link to="/categories" className={itemClass(pathname.startsWith("/categories"))}>
          <Grid2X2 className="size-5" strokeWidth={1.75} />
          Services
        </Link>
        <Link
          to="/claim"
          search={{ q: "", city: "reno" }}
          className={itemClass(
            pathname.startsWith("/claim") || pathname.startsWith("/list-your-business"),
          )}
        >
          <BadgeCheck className="size-5" strokeWidth={1.75} />
          Claim
        </Link>
        <Link
          to="/nv/$city"
          params={{ city: "reno" }}
          className={itemClass(pathname.startsWith("/nv/reno"))}
        >
          <MapPin className="size-5" strokeWidth={1.75} />
          Reno
        </Link>
      </div>
    </nav>
  );
}

const navClass =
  "rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine";

export function SiteShell({
  children,
  wash = false,
}: {
  children: React.ReactNode;
  wash?: boolean;
}) {
  return (
    <div className={cn("min-h-dvh text-ink", wash ? "topo-wash" : "bg-paper")}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="775Directory home">
            <BrandLogo className="hidden w-[11.5rem] sm:block" />
            <BrandMark className="size-10 sm:hidden" />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            <Link to="/nv/$city" params={{ city: "reno" }} className={navClass}>
              Explore Reno
            </Link>
            <Link to="/categories" className={navClass}>
              Services
            </Link>
            <Link to="/list-your-business" className={navClass}>
              List your business
            </Link>
            <Link to="/claim" search={{ q: "", city: "reno" }} className={navClass}>
              Claim your listing
            </Link>
          </nav>
          <AuthSlot />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="mt-12 border-t border-white/10 bg-pine pb-20 text-paper lg:pb-0">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandLogo dark className="w-52" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-paper/70">
              A straightforward business directory for Reno. Find the next call, visit, or quote
              without the runaround.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-paper">Find</p>
            <div className="mt-3 flex flex-col gap-2 text-paper/70">
              <Link to="/nv/$city" params={{ city: "reno" }}>
                Explore Reno
              </Link>
              <Link to="/categories">Services</Link>
              <Link to="/nv/$city/$category" params={{ city: "reno", category: "screen-repair" }}>
                Screen repair in Reno
              </Link>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-medium text-paper">Directory</p>
            <div className="mt-3 flex flex-col gap-2 text-paper/70">
              <Link to="/list-your-business">List your business</Link>
              <Link to="/claim" search={{ q: "", city: "reno" }}>
                Claim a listing
              </Link>
              <Link to="/about">About</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-paper/75">
          Not a newspaper. A directory for the better half of Nevada.
        </p>
      </footer>
      <TabBar />
    </div>
  );
}
