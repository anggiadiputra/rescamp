import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { DataCacheProvider } from "./contexts/DataCacheContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { hasOperatorCapabilities } from "./lib/types";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DomainsPage = lazy(() => import("./pages/DomainsPage"));
const DomainDetailPage = lazy(() => import("./pages/DomainDetailPage"));
const DomainRegisterPage = lazy(() => import("./pages/DomainRegisterPage"));
const DnsManagePage = lazy(() => import("./pages/DnsManagePage"));
const DomainTransferPage = lazy(() => import("./pages/DomainTransferPage"));
const ForwardingPage = lazy(() => import("./pages/ForwardingPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const BillingPayPage = lazy(() => import("./pages/BillingPayPage"));
const PricesPage = lazy(() => import("./pages/PricesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="animate-spin w-7 h-7 border-2 border-gray-300 border-t-black rounded-full" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "customer" && !user.hasProfile) return <Navigate to="/complete-profile" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

// B-6: OperatorRoute replaces ResellerRoute+AdminRoute. A reseller IS an
// admin (the platform operator); the legacy third role no longer exists.
function OperatorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "customer" && !user.hasProfile) return <Navigate to="/complete-profile" replace />;
  if (!hasOperatorCapabilities(user.role)) return <Navigate to="/dashboard" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <PublicLayout>{children}</PublicLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <DataCacheProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/domains" element={<ProtectedRoute><DomainsPage /></ProtectedRoute>} />
                <Route path="/domains/register" element={<ProtectedRoute><DomainRegisterPage /></ProtectedRoute>} />
                <Route path="/domains/:id" element={<ProtectedRoute><DomainDetailPage /></ProtectedRoute>} />
                <Route path="/domains/:id/dns" element={<ProtectedRoute><DnsManagePage /></ProtectedRoute>} />
                <Route path="/domains/:id/forwarding" element={<ProtectedRoute><ForwardingPage /></ProtectedRoute>} />
                <Route path="/domains/transfer" element={<ProtectedRoute><DomainTransferPage /></ProtectedRoute>} />
                <Route path="/customers" element={<OperatorRoute><CustomersPage /></OperatorRoute>} />
                <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                <Route path="/billing/pay/:orderId" element={<BillingPayPage />} />
                <Route path="/prices" element={<ProtectedRoute><PricesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/settings" element={<OperatorRoute><SettingsPage /></OperatorRoute>} />
                <Route path="/complete-profile" element={<CompleteProfilePage />} />
                <Route path="/verify/:param1?/:param2?/:param3?" element={<VerifyPage />} />
                <Route path="/verify/*" element={<VerifyPage />} />
                <Route path="*" element={<PublicLayout><div className="text-center py-16"><p className="text-lg text-gray-500">404 — Page not found</p></div></PublicLayout>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DataCacheProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
