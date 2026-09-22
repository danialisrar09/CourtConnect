import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { SkipNav } from './components/SkipNav';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, CartProvider, ChatProvider } from './contexts';
import { LoadingFallback } from './components/LoadingFallback';
import { ChatWidget } from './components/common';
import { ChatDrawer } from './components/chat/ChatDrawer';
import React from 'react';

// Lazy load all page components for code splitting
const HomePage = lazy(() => import('./components/pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./components/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const FindCourtPage = lazy(() => import('./components/pages/FindCourtPage').then(m => ({ default: m.FindCourtPage })));
const AICourtFinderPage = lazy(() => import('./components/pages/AICourtFinderPage').then(m => ({ default: m.AICourtFinderPage })));
const CustomerDashboard = lazy(() => import('./components/pages/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const BusinessDashboard = lazy(() => import('./components/pages/BusinessDashboard').then(m => ({ default: m.BusinessDashboard })));
const AboutPage = lazy(() => import('./components/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const CourtListingPage = lazy(() => import('./components/pages/CourtListingPage').then(m => ({ default: m.CourtListingPage })));
const CartPage = lazy(() => import('./components/pages/CartPage').then(m => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./components/pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const ReceiptPage = lazy(() => import('./components/pages/ReceiptPage').then(m => ({ default: m.ReceiptPage })));
const AddVenuePage = lazy(() => import('./components/pages/AddVenuePage').then(m => ({ default: m.AddVenuePage })));
const EditVenuePage = lazy(() => import('./components/pages/EditVenuePage'));
const BookingDetailsPage = lazy(() => import('./components/pages/BookingDetailsPage').then(m => ({ default: m.BookingDetailsPage })));
const VenueCalendarPage = lazy(() => import('./components/pages/VenueCalendarPage').then(m => ({ default: m.VenueCalendarPage })));
const NotFoundPage = lazy(() => import('./components/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ErrorPage = lazy(() => import('./components/pages/ErrorPage').then(m => ({ default: m.ErrorPage })));
const ForgotPasswordPage = lazy(() => import('./components/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));

/**
 * Layout component that wraps all pages with Navbar and Footer
 */

const noBgPages = ['/', '/find-court', '/ai-finder'];

function Layout() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isAIFinderPage = location.pathname === '/ai-finder';

  const removeBg = noBgPages.includes(location.pathname);
  const showBg = !removeBg;


  return (
    <div className="min-h-screen">
      <SkipNav />
      <Navbar />
      <main
        id="main-content"
        className={`${showBg ? 'bg-[#98e209]' : ''} ${
          isHomePage || isAIFinderPage ? '' : 'pt-24'
        }`}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes key={location.pathname}>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/find-court" element={<FindCourtPage />} />
            <Route path="/ai-finder" element={<AICourtFinderPage />} />
            <Route path="/court/:id" element={<CourtListingPage />} />
            <Route path="/cart" element={<CartPage />} />

            {/* Protected Routes - Require Authentication */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute requiredUserType="customer">
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/receipt"
              element={
                <ProtectedRoute requiredUserType="customer">
                  <ReceiptPage />
                </ProtectedRoute>
              }
            />

            {/* Customer Dashboard - Requires Customer Role */}
            <Route
              path="/dashboard/customer"
              element={
                <ProtectedRoute requiredUserType="customer">
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Business Dashboard - Requires Business Role */}
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute requiredUserType="business">
                  <BusinessDashboard />
                </ProtectedRoute>
              }
            />

            {/* Add Venue - Requires Business Role */}
            <Route
              path="/venue/add"
              element={
                <ProtectedRoute requiredUserType="business">
                  <AddVenuePage />
                </ProtectedRoute>
              }
            />

            {/* Edit Venue - Requires Business Role */}
            <Route
              path="/venue/edit/:id"
              element={
                <ProtectedRoute requiredUserType="business">
                  <EditVenuePage />
                </ProtectedRoute>
              }
            />

            {/* Booking Details - Requires Business Role */}
            <Route
              path="/booking/:bookingId"
              element={
                <ProtectedRoute requiredUserType="business">
                  <BookingDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* Venue calendar management - Requires Business Role */}
            <Route
              path="/venue/:id/calendar"
              element={
                <ProtectedRoute requiredUserType="business">
                  <VenueCalendarPage />
                </ProtectedRoute>
              }
            />

            {/* 404 Not Found */}
            <Route path="*" element={<NotFoundPage onPageChange={() => {}} />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ChatWidget />
      <ChatDrawer />
      <Toaster />
    </div>
  );
}

/**
 * Main App Component
 * Wraps the application with Router and Context Providers
 */
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <ChatProvider>
            <Layout />
          </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}