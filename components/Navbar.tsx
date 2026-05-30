import Image from "next/image";
import React from "react";

const Navbar = () => {
  return (
    <header className="w-full fixed z-50 bg-('--bg-primary')">
      <div className="wrapper navbar-height py-4 flex justify-between items-center">
        <Link href="/" className="flex gap-0.5 items-center">
          <Image
            src="/assets/logo.png"
            alt="Bookified"
            width={42}
            height={26}
          />
        </Link>
      </div>
    </header>
  );
};

export default Navbar;
