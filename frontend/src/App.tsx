import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import DomainsPage from "./pages/DomainsPage";
import DomainDetailPage from "./pages/DomainDetailPage";
import DomainRegisterPage from "./pages/DomainRegisterPage";
import DnsManagePage from "./pages/DnsManagePage";
import DomainTransferPage from "./pages/DomainTransferPage";
import ForwardingPage from "./pages/ForwardingPage";
import CustomersPage from "./pages/CustomersPage";
import BillingPage from "./pages/BillingPage";
import PricesPage from "./pages/PricesPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import RegisterResellerPage from "./pages/RegisterResellerPage";
import LandingPage from "./pages/LandingPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-black rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "customer" && !user.hasProfile) return <Navigate to="/complete-profile" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function ResellerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-black rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "customer" && !user.hasProfile) return <Navigate to="/complete-profile" replace />;
  if (user.role !== "reseller") return <Navigate to="/dashboard" replace />;
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/register-reseller" element={<PublicRoute><RegisterResellerPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/domains" element={<ProtectedRoute><DomainsPage /></ProtectedRoute>} />
            <Route path="/domains/register" element={<ProtectedRoute><DomainRegisterPage /></ProtectedRoute>} />
            <Route path="/domains/:id" element={<ProtectedRoute><DomainDetailPage /></ProtectedRoute>} />
            <Route path="/domains/:id/dns" element={<ProtectedRoute><DnsManagePage /></ProtectedRoute>} />
            <Route path="/domains/:id/forwarding" element={<ProtectedRoute><ForwardingPage /></ProtectedRoute>} />
            <Route path="/domains/transfer" element={<ProtectedRoute><DomainTransferPage /></ProtectedRoute>} />
            <Route path="/customers" element={<ResellerRoute><CustomersPage /></ResellerRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/prices" element={<ProtectedRoute><PricesPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ResellerRoute><SettingsPage /></ResellerRoute>} />
            <Route path="/complete-profile" element={<CompleteProfilePage />} />
            <Route path="*" element={<PublicLayout><div className="text-center py-16"><p className="text-lg text-gray-500">404 — Page not found</p></div></PublicLayout>} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
