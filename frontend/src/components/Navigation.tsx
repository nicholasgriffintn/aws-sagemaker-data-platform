'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Lightbulb,
  Code,
  Play,
  Database,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Data Pipeline', href: '/data/', icon: Database },
  { name: 'User Bucketing', href: '/bucketing/', icon: Users },
  { name: 'Recommender', href: '/recommender/', icon: Lightbulb },
  { name: 'API Reference', href: '/api/', icon: Code },
  { name: 'Playground', href: '/playground/', icon: Play },
];

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-canvas/90 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-violet flex items-center justify-center">
                <span className="text-canvas font-bold text-lg">ML</span>
              </div>
              <div>
                <span className="font-semibold text-white">
                  AWS ML Platform
                </span>
                <span className="hidden sm:block text-xs text-zinc-500">
                  Documentation
                </span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'text-accent'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-accent/10 rounded-lg"
                        transition={{ type: 'spring', duration: 0.5 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/5"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 z-40 bg-canvas/98 backdrop-blur-xl lg:hidden pt-20"
        >
          <div className="p-6 space-y-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </>
  );
}
