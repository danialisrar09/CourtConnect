import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Menu,
  X,
  User,
  ShoppingCart,
  Bell,
  MessageCircle,
  CalendarCheck,
  CreditCard,
  Wallet,
  Plus,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth, useCart, useToggle } from '../hooks';
import ProfileSwitcher from './auth/ProfileSwitcher';
import { useChat } from '../contexts';
import bookingService from '../services/bookingService';
import chatService from '../services/chatService';

type NotificationTab = 'overview' | 'bookings' | 'messages';

interface NotificationItem {
  id: string;
  type: 'message' | 'booking' | 'payment' | 'spending';
  title: string;
  description: string;
  tab: NotificationTab;
  createdAt?: string;
  unread?: boolean;
}

export function Navbar() {
  const [isMenuOpen, toggleMenu, , closeMenu] = useToggle(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userType, isAuthenticated } = useAuth();
  const { cartCount } = useCart();
  const { unreadTotal, loadConversations } = useChat();
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationStorageKey = useMemo(
    () => `navbar-notification-read:${user?.id || 'guest'}:${userType || 'unknown'}`,
    [user?.id, userType]
  );
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('navbar-notification-read:guest:unknown');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const dashboardPath = userType === 'customer' ? '/dashboard/customer' : '/dashboard/business';

  const openDashboardTab = (tab: NotificationTab) => {
    navigate(dashboardPath, { state: { defaultTab: tab } });
    closeMenu();
    setNotificationOpen(false);
  };

  const openMessages = () => {
    openDashboardTab('messages');
  };

  const formatTime = (value?: string) => {
    if (!value) return 'Now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Now';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      setReadNotificationIds(raw ? JSON.parse(raw) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(notificationStorageKey, JSON.stringify(readNotificationIds));
  }, [notificationStorageKey, readNotificationIds]);

  const buildNotifications = (chatRows: any[], bookingRows: any[], readIds: string[]): NotificationItem[] => {
    const items: NotificationItem[] = [];

    const unreadConversations = chatRows
      .filter((conversation) => Number(conversation.unreadCount || 0) > 0)
      .slice(0, 4);

    unreadConversations.forEach((conversation) => {
      const itemId = `msg-${conversation.id}`;
      items.push({
        id: itemId,
        type: 'message',
        title: `New message from ${conversation.otherParticipant.name}`,
        description: conversation.lastMessageText || 'You have unread chat messages.',
        tab: 'messages',
        createdAt: conversation.lastMessageAt || undefined,
        unread: !readIds.includes(itemId),
      });
    });

    const bookingConfirmations = bookingRows
      .filter((b: any) => ['confirmed', 'completed'].includes(String(b?.status || '').toLowerCase()))
      .slice(0, 2);

    bookingConfirmations.forEach((booking: any) => {
      const itemId = `booking-${String(booking?._id || booking?.id || Math.random())}`;
      items.push({
        id: itemId,
        type: 'booking',
        title: 'Booking confirmed',
        description: `${booking?.venue?.title || booking?.venueName || 'Court booking'} is ${String(booking?.status || 'confirmed').toLowerCase()}.`,
        tab: 'bookings',
        createdAt: booking?.updatedAt || booking?.bookingDate,
        unread: !readIds.includes(itemId),
      });
    });

    const paymentAlerts = bookingRows
      .filter((b: any) => {
        const paymentStatus = String(b?.paymentStatus || '').toLowerCase();
        return ['pending', 'failed', 'unpaid', 'requires_payment'].includes(paymentStatus);
      })
      .slice(0, 2);

    paymentAlerts.forEach((booking: any) => {
      const itemId = `payment-${String(booking?._id || booking?.id || Math.random())}`;
      items.push({
        id: itemId,
        type: 'payment',
        title: 'Payment alert',
        description: `${booking?.venue?.title || booking?.venueName || 'Booking'} payment is ${String(booking?.paymentStatus || 'pending').toLowerCase()}.`,
        tab: 'bookings',
        createdAt: booking?.updatedAt || booking?.bookingDate,
        unread: !readIds.includes(itemId),
      });
    });

    if (userType === 'customer' && bookingRows.length > 0) {
      const totalSpent = bookingRows.reduce((sum: number, booking: any) => {
        const paymentStatus = String(booking?.paymentStatus || '').toLowerCase();
        if (paymentStatus !== 'paid') return sum;
        const amountPaid = Number(booking?.paymentInfo?.amountPaid ?? booking?.amountPaid ?? booking?.totalPrice ?? 0);
        return sum + (Number.isFinite(amountPaid) ? amountPaid : 0);
      }, 0);

      items.push({
        id: 'spent-summary',
        type: 'spending',
        title: 'Amount spent summary',
        description: `You have spent Rs ${Math.round(totalSpent).toLocaleString()} on court bookings.`,
        tab: 'overview',
        createdAt: new Date().toISOString(),
        unread: !readIds.includes('spent-summary'),
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'no-notifications',
        type: 'message',
        title: 'No new notifications',
        description: 'You are all caught up.',
        tab: 'overview',
        unread: false,
      });
    }

    return items;
  };

  const loadNotifications = async () => {
    if (!isAuthenticated) return;

    setNotificationLoading(true);
    try {
      const [chatResponse, bookingResponse] = await Promise.all([
        chatService.getConversations({ limit: 20 }),
        bookingService.getMyBookings(),
      ]);

      // Keep chat context updated for rest of app unread badges.
      loadConversations().catch(() => undefined);

      const chatRows = chatResponse?.conversations || [];
      const bookings = bookingResponse?.data?.bookings || bookingResponse?.bookings || [];
      setNotificationItems(buildNotifications(Array.isArray(chatRows) ? chatRows : [], Array.isArray(bookings) ? bookings : [], readNotificationIds));
    } catch {
      setNotificationItems([
        {
          id: 'notification-error',
          type: 'payment',
          title: 'Unable to load notifications',
          description: 'Please try again.',
          tab: 'overview',
          unread: true,
        },
      ]);
    } finally {
      setNotificationLoading(false);
    }
  };

  const toggleNotifications = async () => {
    const nextState = !notificationOpen;
    setNotificationOpen(nextState);
    if (nextState) {
      await loadNotifications();
    }
  };

  useEffect(() => {
    if (!notificationOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [notificationOpen]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationItems([]);
      return;
    }

    loadNotifications().catch(() => undefined);
  }, [isAuthenticated, user?.id, userType, unreadTotal]);

  const notificationCount = useMemo(() => {
    return notificationItems.filter(
      (item) => item.id !== 'no-notifications' && !readNotificationIds.includes(item.id)
    ).length;
  }, [notificationItems, readNotificationIds]);

  const markNotificationAsRead = (notificationId: string) => {
    setReadNotificationIds((current) => {
      if (current.includes(notificationId)) return current;
      return [...current, notificationId];
    });

    setNotificationItems((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, unread: false } : item
      )
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/find-court', { state: { query: searchQuery } });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-4 left-4 right-4 z-50 bg-white shadow-lg rounded-md border border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo - Left Corner */}
          <div className="flex-shrink-0 h-20 flex items-center overflow-hidden">
            <Link
              to="/"
              className="inline-block focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded"
              aria-label="CourtConnect Home"
            >
              <img
                src="/logo-transparent.png"
                alt="CourtConnect Logo"
                className="h-48 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Center Navigation - Only show for non-business users */}
          {userType !== 'business' && (
            <div className="hidden md:flex items-center gap-2 flex-1 justify-center mx-2 lg:mx-4">
              {/* Find Courts */}
              <Link
                to="/find-court"
                className={`px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${isActive('/find-court')
                  ? 'bg-[#98e209] text-[#010101]'
                  : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                  }`}
              >
                <Search className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm lg:text-base">Find Courts</span>
              </Link>

              {/* AI Finder */}
              <Link
                to="/ai-finder"
                className={`px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${isActive('/ai-finder')
                  ? 'bg-[#98e209] text-[#010101]'
                  : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                  }`}
              >
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm lg:text-base">AI Finder</span>
              </Link>

              {/* About */}
              <Link
                to="/about"
                className={`px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${isActive('/about')
                  ? 'bg-[#98e209] text-[#010101]'
                  : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                  }`}
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm lg:text-base">About</span>
              </Link>
            </div>
          )}

          {/* Right Corner - Login/Dashboard and Cart */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {isAuthenticated ? (
              <>
                {/* Dashboard */}
                <Link
                  to={userType === 'customer' ? '/dashboard/customer' : '/dashboard/business'}
                  className={`px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${location.pathname.includes('/dashboard')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                    }`}
                >
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap text-sm lg:text-base">Dashboard</span>
                </Link>

                {user?.profileType === 'both' && (
                  <ProfileSwitcher />
                )}

                <div className="relative" ref={notificationRef}>
                  <button
                    type="button"
                    onClick={() => {
                      toggleNotifications().catch(() => undefined);
                    }}
                    className={`relative px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center justify-center whitespace-nowrap ${location.pathname.includes('/dashboard')
                      ? 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                      : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                      }`}
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4 flex-shrink-0" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-semibold rounded-full h-6 min-w-7 px-2 flex items-center justify-center leading-none">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <div
                      className="fixed overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                      style={{
                        zIndex: 12000,
                        top: 112,
                        right: 16,
                        width: 340,
                        maxWidth: 'calc(100vw - 32px)',
                      }}
                    >
                      <div className="border-b border-gray-100 px-4 py-3">
                        <p className="text-sm font-semibold text-[#010101]">Notifications</p>
                        <p className="text-xs text-gray-500">Messages, bookings, payment alerts and spending updates</p>
                      </div>

                      <div className="max-h-[60vh] overflow-y-auto">
                        {notificationLoading ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading notifications...</div>
                        ) : (
                          <div className="p-2">
                            {notificationItems.map((item) => {
                              const isUnread = item.id !== 'no-notifications' && !readNotificationIds.includes(item.id);
                              const icon =
                                item.type === 'message'
                                  ? <MessageCircle className="h-4 w-4 text-[#010101]" />
                                  : item.type === 'booking'
                                    ? <CalendarCheck className="h-4 w-4 text-[#010101]" />
                                    : item.type === 'payment'
                                      ? <CreditCard className="h-4 w-4 text-[#b91c1c]" />
                                      : <Wallet className="h-4 w-4 text-[#065f46]" />;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    markNotificationAsRead(item.id);
                                    openDashboardTab(item.tab);
                                  }}
                                  className={`w-full rounded-xl border px-3 py-3 text-left transition hover:border-[#d9ef9d] hover:bg-[#f8fbea] ${
                                    isUnread
                                      ? 'border-[#edf6d0] bg-[#fbfef2]'
                                      : 'border-transparent bg-white'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ecf6cd]">
                                      {icon}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <p className="truncate text-sm font-semibold text-[#010101]">{item.title}</p>
                                          {isUnread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
                                        </div>
                                        <span className="shrink-0 text-[11px] text-gray-400">{formatTime(item.createdAt)}</span>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-600 wrap-break-word">{item.description}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cart (Authenticated) */}
                {userType === 'customer' && (
                  <Link
                    to="/cart"
                    className={`relative px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center justify-center whitespace-nowrap ${isActive('/cart')
                      ? 'bg-[#98e209] text-[#010101]'
                      : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                      }`}
                  >
                    <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                )}
              </>
            ) : (
              <>
                {/* Login */}
                <Link
                  to="/login"
                  className={`px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center gap-1.5 lg:gap-2 whitespace-nowrap ${isActive('/login')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                    }`}
                >
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap text-sm lg:text-base">Login</span>
                </Link>

                {/* Cart (Guest) */}
                <Link
                  to="/cart"
                  className={`relative px-3 lg:px-4 py-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 flex items-center justify-center whitespace-nowrap ${isActive('/cart')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-[#98e209] hover:text-[#010101]'
                    }`}
                >
                  <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>


          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-[#010101] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2"
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 rounded-b-2xl">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="px-3 py-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Search courts..."
                  className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded-full"
                  aria-label="Search courts"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Only show Find Courts and About for non-business users */}
            {userType !== 'business' && (
              <>
                <Link
                  to="/find-court"
                  onClick={closeMenu}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${isActive('/find-court')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-gray-100'
                    }`}
                >
                  <Search className="h-4 w-4" />
                  Find Courts
                </Link>

                <Link
                  to="/ai-finder"
                  onClick={closeMenu}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${isActive('/ai-finder')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-gray-100'
                    }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>AI Finder</span>
                </Link>

                <Link
                  to="/about"
                  onClick={closeMenu}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${isActive('/about')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-gray-100'
                    }`}
                >
                  <Info className="h-4 w-4" />
                  About
                </Link>
              </>
            )}

            {isAuthenticated ? (
              <>
                <Link
                  to={userType === 'customer' ? '/dashboard/customer' : '/dashboard/business'}
                  onClick={closeMenu}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/dashboard')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-gray-100'
                    }`}
                >
                  <User className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>

                <button
                  type="button"
                  onClick={() => openDashboardTab('messages')}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors text-[#010101] hover:bg-gray-100"
                >
                  <Bell className="h-4 w-4" />
                  <span className="flex-1">Notifications</span>
                  {notificationCount > 0 && (
                    <span className="bg-red-500 text-white text-[11px] font-semibold rounded-full h-6 min-w-7 px-2 flex items-center justify-center leading-none" aria-hidden="true">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>

                {/* Profile Switcher for dual-role users (mobile) */}
                {user?.profileType === 'both' && (
                  <div className="px-3 py-2 border-b border-gray-200 pb-3 mb-2">
                    <ProfileSwitcher />
                  </div>
                )}

                {userType === 'business' && (
                  <Link
                    to="/venue/add"
                    onClick={closeMenu}
                    className="block w-full text-left px-3 py-2 rounded-md bg-[#98e209] text-[#010101]"
                  >
                    Add New Venue
                  </Link>
                )}

                {userType === 'customer' && (
                  <Link
                    to="/cart"
                    onClick={closeMenu}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md transition-colors ${isActive('/cart')
                      ? 'bg-[#98e209] text-[#010101]'
                      : 'text-[#010101] hover:bg-gray-100'
                      }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="flex-1">Cart</span>
                    {cartCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" aria-hidden="true">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/cart"
                  onClick={closeMenu}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-md transition-colors ${isActive('/cart')
                    ? 'bg-[#98e209] text-[#010101]'
                    : 'text-[#010101] hover:bg-gray-100'
                    }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="flex-1">Cart</span>
                  {cartCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" aria-hidden="true">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="block w-full text-left px-3 py-2 bg-[#98e209] text-[#010101] rounded-md"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}