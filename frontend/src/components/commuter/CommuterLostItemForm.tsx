import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, CheckCircle2, Shield, Smartphone, Wallet, Briefcase, FileText, Key, MoreHorizontal } from 'lucide-react';
import { Ride, LostItemCategory } from '../../types';
import { api } from '../../services/api';

interface Props {
  ride: Ride;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export const CommuterLostItemForm: React.FC<Props> = ({ ride, onBack, onSubmitSuccess }) => {
  const [selectedCategory, setSelectedCategory] = useState<LostItemCategory>('wallet');
  const [description, setDescription] = useState('Black wallet with IDs and student pass');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const categories: { key: LostItemCategory; label: string; icon: any }[] = [
    { key: 'phone', label: 'Phone', icon: Smartphone },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
    { key: 'bag', label: 'Bag', icon: Briefcase },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'keys', label: 'Keys', icon: Key },
    { key: 'other', label: 'Other', icon: MoreHorizontal }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.reportLostItem({
        rideId: ride.ride_id,
        itemCategory: selectedCategory,
        description,
        passengerId: 'USR-COM-001',
        passengerName: 'Maria Santos',
        passengerContact: '09187654321'
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-xs font-mono text-slate-400">{ride.vehicle_id}</span>
        </div>

        <div>
          <h1 className="text-xl font-black text-slate-900">Report Lost Item</h1>
          <p className="text-xs text-slate-500">
            TalaRide will contact the driver of {ride.vehicle_id} without exposing your private phone number.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm my-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Driver Notified</h2>
              <p className="text-xs text-slate-500">
                Driver <strong className="text-slate-800">{ride.driver_name}</strong> has received an alert regarding your forgotten <span className="capitalize">{selectedCategory}</span>.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-left text-xs text-slate-600 space-y-1 border border-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-400">Mediated Communication</div>
              <p>
                When the driver confirms whether the item is found, your TalaRide notification center will update immediately.
              </p>
            </div>

            <button
              onClick={onSubmitSuccess}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
            >
              Back to Ride Details
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                What did you leave behind?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const isSelected = selectedCategory === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setSelectedCategory(c.key)}
                      className={`p-3 rounded-xl border-2 text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Item Description & Identifiers
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Black leather wallet with student ID and blue keychain..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500 shadow-xs"
                required
              />
            </div>

            {/* Privacy notice banner (Section 14 & 28) */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Guaranteed:</strong> TalaRide mediates this report. Your mobile number and personal contact info are never shared directly with other passengers.
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !description}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-base rounded-2xl transition shadow-xl shadow-emerald-600/20 disabled:opacity-50"
              >
                {loading ? 'Sending Alert to Driver...' : 'SUBMIT REPORT'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
