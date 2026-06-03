"use client";

import React from "react";
import Link from "next/link";
import { navLinks } from "@/lib/constants";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NavLinks = () => {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-8">
      {navLinks.map((item) => (
        <Link
          key={item.url}
          href={item.url}
          className={cn(
            "text-sm font-medium",
            pathname === item.url && "border-b-2 border-[#1a1a1a] pb-0.5",
          )}
        >
          {item.name}
        </Link>
      ))}

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
          A
        </div>
        <span className="text-sm font-medium">Adrian</span>
      </div>
    </nav>
  );
};

export default NavLinks;
