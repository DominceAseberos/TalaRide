import { useEffect, useState } from 'react';
import { PublicVehiclePage } from './components/public/PublicVehiclePage';
import { PaymentReturnPage } from './components/public/PaymentReturnPage';
import { TodaLogin, type TodaSession } from './components/auth/TodaLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { RegisteredDriverPortal } from './components/driver/RegisteredDriverPortal';
import { api } from './services/api';
import { getAuthClient, signOut } from './services/auth';

export function App() {
  const [operator, setOperator] = useState<TodaSession | null>(null);
  const [error, setError] = useState('');
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  useEffect(() => {
    if (path !== '/' && path !== '/admin') return;
    let active = true;
    void getAuthClient().then(c => c.auth.getSession()).then(async result => {
      if (!result.data.session) return;
      const account = await api.getCurrentAccount();
      if (active && ['talaride_admin', 'lgu_admin'].includes(account.user.role)) {
        setOperator({ name: account.user.full_name, group: 'TODA operations', email: result.data.session.user.email || '' });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [path]);
  if (path === '/success' || path === '/cancel') return <PaymentReturnPage paymentId={query.get('payment_id') || ''} cancelled={path === '/cancel'} />;
  if (path.startsWith('/v/')) return <PublicVehiclePage vehicleCode={path.split('/')[2]} checksum={query.get('c') || ''} />;
  if (path === '/driver') return <RegisteredDriverPortal />;
  return <>{error && <p role="alert">{error}</p>}{operator ? <AdminDashboard operatorName={operator.name} todaName={operator.group} onSignOut={() => void signOut().then(() => setOperator(null)).catch(e => setError(e.message))} /> : <TodaLogin onAuthenticated={setOperator} />}</>;
}
export default App;
