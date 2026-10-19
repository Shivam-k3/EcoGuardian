import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Simulator from './pages/Simulator';
import Assistant from './pages/Assistant';
import Gamification from './pages/Gamification';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import ExplainableAI from './pages/ExplainableAI';
import Twin from './pages/Twin';
import Landing from './pages/Landing';
import Legal from './pages/Legal';
import { isSupabaseConfigured, missingSupabaseEnvVars } from './services/supabaseClient';

function ConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fa] dark:bg-gray-950 px-6">
      <div className="max-w-md w-full rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <img src="/leaf.svg" alt="" className="w-10 h-10 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Configuration required
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This deployment is missing required Supabase environment variables, so
          EcoGuardian cannot start. The app was built without them being
          available at build time.
        </p>
        <ul className="text-sm font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 mb-4">
          {missingSupabaseEnvVars.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set both variables for the Production and Preview environments in the
          Vercel project settings, then <strong>redeploy</strong> — Vercel bakes
          environment variables in at build time, so existing deployments are
          not updated retroactively.
        </p>
      </div>
    </div>
  );
}

function AppLayout() {
  // Roles with full personal mobility-tool access (spec §1/§4):
  const PERSONAL_TOOLS = ['student', 'individual', 'faculty'];
  return (
    <Layout>
      <PageTransition>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calculator" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><Calculator /></ProtectedRoute>
          } />
          <Route path="/simulator" element={
            <ProtectedRoute allowedRoles={PERSONAL_TOOLS}><Simulator /></ProtectedRoute>
          } />
          <Route path="/assistant" element={
            <ProtectedRoute allowedRoles={PERSONAL_TOOLS}><Assistant /></ProtectedRoute>
          } />
          <Route path="/gamification" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><Gamification /></ProtectedRoute>
          } />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/explainable-ai" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><ExplainableAI /></ProtectedRoute>
          } />
          <Route path="/twin" element={
            <ProtectedRoute allowedRoles={PERSONAL_TOOLS}><Twin /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['super_admin', 'college_admin']}><Admin /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PageTransition>
    </Layout>
  );
}

export default function App() {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) {
      console.error(
        'Supabase is not configured. Missing environment variables:',
        missingSupabaseEnvVars
      );
    }
    return <ConfigErrorScreen />;
  }
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal/privacy" element={<Legal />} />
          <Route path="/legal/terms" element={<Legal />} />
          <Route path="/legal/security" element={<Legal />} />
          <Route path="/legal/cookies" element={<Legal />} />
          <Route path="/change-password" element={
            <ProtectedRoute allowFirstLogin><ChangePassword /></ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute><AppLayout /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
