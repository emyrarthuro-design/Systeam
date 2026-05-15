import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Diagnosis } from '../types';

export default function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const loadDiagnosis = () => {
      const data = localStorage.getItem('systeam_diagnosis');
      if (data) {
        setDiagnosis(JSON.parse(data) as Diagnosis);
      }
    };
    
    loadDiagnosis();
    
    const interval = setInterval(loadDiagnosis, 2000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const progress = diagnosis?.progress || 0;

  return (
    <nav className="h-[72px] border-b border-sys-border flex items-center justify-between px-6 bg-sys-bg/80 sticky top-0 z-50 backdrop-blur-md">
      <Link to={user ? "/dashboard" : "/"} className="flex items-center">
        <span className="font-sans font-bold tracking-tight lowercase text-sys-text-main text-3xl h-[36px] flex items-center leading-none">
          systeam<span className="text-sys-accent">.</span>
        </span>
      </Link>

      <div className="flex items-center gap-6">
        {user && (
          <div className="hidden lg:flex flex-col items-end mr-4">
            <span className="text-[10px] text-sys-text-sec uppercase font-bold tracking-[0.15em]">Progreso Total</span>
            <div className="w-48 h-1.5 bg-sys-border rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-sys-accent transition-all duration-500" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sys-accent/10 text-sys-accent hover:bg-sys-accent/20 transition-colors text-xs font-bold mr-2">
                  <Shield size={14} />
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-sys-input border border-sys-border flex items-center justify-center text-[10px] font-bold group-hover:border-sys-accent transition-colors text-sys-text-sec group-hover:text-sys-accent">
                  {profile?.fullName?.substring(0, 2).toUpperCase() || 'EX'}
                </div>
                <span className="text-sm font-normal text-white hidden sm:inline">
                  Hola{profile?.fullName ? <>, <span className="text-sys-accent font-bold">{profile.fullName.split(' ')[0]}</span></> : ''}
                </span>
              </Link>
              <button 
                onClick={handleLogout}
                className="text-sys-text-mut hover:text-sys-error transition-colors ml-2"
                title="Cerrar Sesión"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
               <Link to="/login" className="text-sm font-bold text-white hover:text-sys-accent transition-colors">
                 Iniciar sesión
               </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
