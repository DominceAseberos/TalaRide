import React, { useState } from 'react';
import { ShieldCheck, Phone, KeyRound, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

interface Props {
  onLoginSuccess: (driver: any) => void;
}

export const DriverLogin: React.FC<Props> = ({ onLoginSuccess }) => {
  const [mobileNumber, setMobileNumber] = useState('09171234567');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('8842');
  const [pin, setPin] = useState('1234');
  const [step, setStep] = useState<'mobile' | 'otp' | 'pin'>('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || mobileNumber.length < 10) {
      setError('Please enter a valid 11-digit Philippine mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.requestOtp(mobileNumber, 'driver');
      setOtpSent(true);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(mobileNumber, otp, 'driver', 'Juan Dela Cruz');
      if (res.success) {
        setStep('pin');
      } else {
        setError(res.error || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'OTP Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Driver profile loaded
      const driverRes = await api.getDriver('DR-000481');
      onLoginSuccess(driverRes.driver);
    } catch (err) {
      onLoginSuccess({
        driver_id: 'DR-000481',
        name: 'Juan Dela Cruz',
        mobile_number: mobileNumber,
        verification_status: 'verified',
        toda_operator: 'Tagum Poblacion TODA',
        assigned_vehicle_id: 'TR-01842',
        shift_status: 'ended'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-4 py-8 bg-slate-900 text-white">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">TalaRide Driver</h1>
          <p className="text-sm text-slate-400">Tagum City Tricycle Partner Portal</p>
        </div>

        {/* Demo Quick fill banner */}
        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Verified Demo Driver: DR-000481 (Juan D.)
          </span>
          <span className="text-[11px] bg-emerald-800 px-2 py-0.5 rounded text-emerald-100 font-mono">OTP: 8842</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Step 1: Mobile */}
        {step === 'mobile' && (
          <form onSubmit={handleSendOtp} className="space-y-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Driver Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="09171234567"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold text-base rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send Login OTP'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Enter 4-Digit OTP
              </label>
              <input
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full py-3 text-center bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-2xl tracking-widest focus:outline-hidden focus:border-emerald-500"
                required
              />
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Demo code: <span className="font-mono text-emerald-400 font-bold">8842</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold text-base rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* Step 3: PIN / Biometrics */}
        {step === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
            <div className="text-center space-y-1 mb-2">
              <div className="inline-flex p-3 rounded-full bg-slate-700 text-emerald-400 mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">Driver Quick PIN</h3>
              <p className="text-xs text-slate-400">Enter your 4-digit security PIN to access shift</p>
            </div>

            <div>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full py-3 text-center bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-2xl tracking-widest focus:outline-hidden focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold text-base rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Opening Portal...' : 'Unlock Driver Shift'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
