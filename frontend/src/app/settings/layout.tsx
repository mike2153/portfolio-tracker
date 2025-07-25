'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, CreditCard, Shield, Bell } from 'lucide-react';
import GradientText from '@/components/ui/GradientText';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  const settingsNav = [
    {
      href: '/settings/profile',
      label: 'Profile',
      icon: User,
      description: 'Manage your personal information'
    },
    {
      href: '/settings/account',
      label: 'Account & Billing',
      icon: CreditCard,
      description: 'Manage payment methods and billing'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <GradientText className="text-3xl font-bold mb-2">Settings</GradientText>
          <p className="text-[#8B949E]">Manage your account and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#30363D] text-white'
                        : 'text-[#8B949E] hover:bg-[#30363D]/50 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 mt-0.5" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs mt-0.5 opacity-75">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}