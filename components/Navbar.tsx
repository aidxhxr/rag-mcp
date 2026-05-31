"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignInButton, UserButton, useAuth, useUser } from "@clerk/nextjs";

const navItems = [
  { label: "Library", href: "/" },
  { label: "Add New", href: "/books/new" },
];

const Navbar = () => {
  const pathName = usePathname();
  const { user } = useUser();
  const { isSignedIn, isLoaded } = useAuth();
  return (
    <header className="w-full fixed z-50 bg-(--bg-primary)">
      <div className="wrapper navbar-height py-4 flex justify-between items-center">
        <Link href="/" className="flex gap-0.5 items-center">
          <Image
            src="/assets/logo.png"
            alt="Bookified"
            width={42}
            height={26}
          />
          <span className="logo-text">Bookified</span>
        </Link>
        <nav className="w-fit flex gap-7.5 items-center">
          {navItems.map(({ label, href }) => {
            const isActive =
              href === "/" ? pathName === "/" : pathName.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "nav-link-base",
                  isActive && "nav-link-active",
                  !isActive && "text-black hover:opacity-70",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex gap-7.5 items-center">
          {!isLoaded ? null : isSignedIn ? (
            <>
              <UserButton />
              {user?.firstName && (
                <Link href="/subscriptions" className="nav-user-name">
                  {user.firstName}
                </Link>
              )}
            </>
          ) : (
            <SignInButton>
              <button>Sign in</button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
