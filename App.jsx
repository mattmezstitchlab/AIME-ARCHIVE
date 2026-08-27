import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Overview from '@/pages/Overview';
import Chat from '@/pages/Chat';
import Timeline from '@/pages/Timeline';
import Scenarios from '@/pages/Scenarios';
import LiveDay from '@/pages/LiveDay';
import People from '@/pages/People';
import Groups from '@/pages/Groups';
import SocialGraph from '@/pages/SocialGraph';
import SocialConstraints from '@/pages/SocialConstraints';
import Tables from '@/pages/Tables';
import Resources from '@/pages/Resources';
import Events from '@/pages/Events';
import Nexus from '@/pages/Nexus';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  }
  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Layout />}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/scenarios" element={<Scenarios />} />
        <Route path="/live" element={<LiveDay />} />
        <Route path="/people" element={<People />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/social-graph" element={<SocialGraph />} />
        <Route path="/social-constraints" element={<SocialConstraints />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/events" element={<Events />} />
        <Route path="/nexus" element={<Nexus />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router><ScrollToTop /><AuthenticatedApp /></Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}
export default App