import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { PlanYearProvider } from '@/lib/PlanYearContext'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CompaniesPage from '@/pages/CompaniesPage'
import CompanyDetailPage from '@/pages/CompanyDetailPage'
import CompliancePage from '@/pages/CompliancePage'
import SPDBuilderPage from '@/pages/SPDBuilderPage'
import PlanComparisonPage from '@/pages/PlanComparisonPage'
import FormsPage from '@/pages/FormsPage'
import RenewalPage from '@/pages/RenewalPage'
import ClientPortalPage from '@/pages/ClientPortalPage'
import ProfilePage from '@/pages/ProfilePage'
import CobraPage from '@/pages/CobraPage'
import FmlaPage from '@/pages/FmlaPage'
import PublicComparePage from '@/pages/PublicComparePage'
import RegisterPage from '@/pages/RegisterPage'
import CompanyImportPage from '@/pages/CompanyImportPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import RateSheetPage from '@/pages/RateSheetPage'
import PremiumSheetPage from '@/pages/PremiumSheetPage'
import ProspectPage from '@/pages/ProspectPage'
import ProspectsPage from '@/pages/ProspectsPage'
import DocumentLibraryPage from '@/pages/DocumentLibraryPage'
import EnrollmentPage from '@/pages/EnrollmentPage'
import PlanYearPage from '@/pages/PlanYearPage'
import AcaRateSheetPage from '@/pages/AcaRateSheetPage'
import AcaCalculatorPage from '@/pages/AcaCalculatorPage'
import HandbookPage from '@/pages/HandbookPage'
import '@/index.css'

// Public routes — never require auth, render immediately
const PUBLIC_PATHS = ['/plans', '/reset-password', '/login', '/register', '/terms-of-service', '/privacy-policy']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/prospect/')
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-kiaa-600">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role === 'hr_client') return <Navigate to="/portal" replace />
  return children
}

function AppRoutes() {
  const { profile, loading } = useAuth()
  const location = useLocation()

  // Public routes — render without waiting for auth
  if (isPublicPath(location.pathname)) {
    return (
      <Routes>
        <Route path="/prospect/:token"  element={<ProspectPage />} />
        <Route path="/plans"            element={<PublicComparePage />} />
        <Route path="/register"       element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login"          element={<LoginPage />} />
      </Routes>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-kiaa-600">Loading…</div>

  // HR clients
  if (profile?.role === 'hr_client') {
    return (
      <Routes>
        <Route path="/portal"  element={<ProtectedRoute><ClientPortalPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
        <Route path="/cobra"   element={<ProtectedRoute><Layout><CobraPage /></Layout></ProtectedRoute>} />
        <Route path="/fmla"    element={<ProtectedRoute><Layout><FmlaPage /></Layout></ProtectedRoute>} />
        <Route path="*"        element={<Navigate to="/portal" replace />} />
      </Routes>
    )
  }

  // Admin / staff
  return (
    <Routes>
      <Route path="/"               element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/companies"      element={<ProtectedRoute><Layout><CompaniesPage /></Layout></ProtectedRoute>} />
      <Route path="/companies/:id"  element={<ProtectedRoute><Layout><CompanyDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/compliance"     element={<ProtectedRoute><Layout><CompliancePage /></Layout></ProtectedRoute>} />
      <Route path="/spd"            element={<ProtectedRoute><Layout><SPDBuilderPage /></Layout></ProtectedRoute>} />
      <Route path="/compare"        element={<ProtectedRoute><Layout><PlanComparisonPage /></Layout></ProtectedRoute>} />
      <Route path="/forms"          element={<ProtectedRoute><Layout><FormsPage /></Layout></ProtectedRoute>} />
      <Route path="/renewals"       element={<ProtectedRoute><Layout><RenewalPage /></Layout></ProtectedRoute>} />
      <Route path="/profile"        element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/portal"         element={<ProtectedRoute><ClientPortalPage /></ProtectedRoute>} />
      <Route path="/cobra"          element={<ProtectedRoute><Layout><CobraPage /></Layout></ProtectedRoute>} />
      <Route path="/fmla"           element={<ProtectedRoute><Layout><FmlaPage /></Layout></ProtectedRoute>} />
      <Route path="/rates"          element={<ProtectedRoute><Layout><RateSheetPage /></Layout></ProtectedRoute>} />
      <Route path="/prospects"      element={<ProtectedRoute><Layout><ProspectsPage /></Layout></ProtectedRoute>} />
      <Route path="/premium-sheet"  element={<ProtectedRoute><Layout><PremiumSheetPage /></Layout></ProtectedRoute>} />
      <Route path="/documents"      element={<ProtectedRoute><Layout><DocumentLibraryPage /></Layout></ProtectedRoute>} />
      <Route path="/enrollment"     element={<ProtectedRoute><Layout><EnrollmentPage /></Layout></ProtectedRoute>} />
      <Route path="/import"         element={<ProtectedRoute adminOnly><Layout><CompanyImportPage /></Layout></ProtectedRoute>} />
      <Route path="/aca-rates"      element={<ProtectedRoute><Layout><AcaRateSheetPage /></Layout></ProtectedRoute>} />
      <Route path="/aca-calc"       element={<ProtectedRoute><Layout><AcaCalculatorPage /></Layout></ProtectedRoute>} />
      <Route path="/plan-year"      element={<ProtectedRoute><Layout><PlanYearPage /></Layout></ProtectedRoute>} />
      <Route path="/handbook"       element={<ProtectedRoute><Layout><HandbookPage /></Layout></ProtectedRoute>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlanYearProvider>
          <AppRoutes />
        </PlanYearProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
