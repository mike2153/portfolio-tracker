"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ href, icon, children }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  // Commenting out sidebar debug log
  //console.log('[SIDEBAR] pathname:', pathname, 'href:', href, 'active:', isActive);

  const baseClass = 'flex items-center space-x-3 rounded-md px-3 py-2';
  const activeClass = 'bg-gray-700 text-white';
  const inactiveClass = 'hover:bg-gray-700/50 text-gray-300';

  return (
    <Link href={href} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}> 
      {icon}
      <span>{children}</span>
    </Link>
  );
};

export default SidebarLink; 