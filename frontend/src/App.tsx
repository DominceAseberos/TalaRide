import { useEffect, useState } from 'react';
import { PublicVehiclePage } from './components/public/PublicVehiclePage';
import { PaymentReturnPage } from './components/public/PaymentReturnPage';
import { TodaLogin, type TodaSession } from './components/auth/TodaLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TodaDashboard } from './components/toda/TodaDashboard';
import { api } from './services/api';
import { getAuthClient, signOut } from './services/auth';

export function App() {
  const [operator, setOperator] = useState<TodaSession | null>(null);
  const [error, setError] = useState('');
  const [testPayments, setTestPayments] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/config`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(config => setTestPayments(config?.paymentEnvironment === 'test'))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  useEffect(() => {
    if (path !== '/' && path !== '/admin') return;
    let active = true;
    void getAuthClient().then(c => c.auth.getSession()).then(async result => {
      if (!result.data.session) return;
      const account = await api.getCurrentAccount();
      if (active && ['operator', 'talaride_admin', 'lgu_admin'].includes(account.user.role)) {
        setOperator({ name: account.user.full_name, role: account.user.role, group: account.user.toda_group?.name || 'TalaRide administration', email: result.data.session.user.email || '' });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [path]);
  const page = path === '/success' || path === '/cancel' ? <PaymentReturnPage paymentId={query.get('payment_id') || ''} cancelled={path === '/cancel'} />
    : path.startsWith('/v/') ? <PublicVehiclePage vehicleCode={path.split('/')[2]} checksum={query.get('c') || ''} />
    : <>{error && <p role="alert">{error}</p>}{operator ? operator.role === 'operator'
      ? <TodaDashboard operatorName={operator.name} onSignOut={() => void signOut().then(() => setOperator(null)).catch(e => setError(e.message))} />
      : <AdminDashboard canVerify={operator.role === 'talaride_admin'} operatorName={operator.name} todaName={operator.group} onSignOut={() => void signOut().then(() => setOperator(null)).catch(e => setError(e.message))} /> : <TodaLogin onAuthenticated={setOperator} />}</>;
  return <>{testPayments && <div role="status" className="bg-warning-soft px-4 py-3 text-center text-sm font-semibold text-warning">PayMongo test mode — no real money is charged.</div>}{page}</>;
}
export default App;
