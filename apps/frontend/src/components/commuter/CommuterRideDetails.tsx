import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, HelpCircle, CheckCircle2, MapPin, Calendar, Clock, Bike, User } from 'lucide-react';
import { Ride } from '../../types';
import { api } from '../../services/api';

interface Props {
  ride: Ride;
  onBack: () => void;
  onReportLostItem: () => void;
}

export const CommuterRideDetails: React.FC<Props> = ({ ride, onBack, onReportLostItem }) => {
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('wrong_amount');
  const [description, setDescription] = useState('');
  const [issueSubmitted, setIssueSubmitted] = useState(false);

  const dateObj = new Date(ride.timestamp);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.reportPaymentIssue({
        rideId: ride.ride_id,
        issueType,
        description,
        reportedBy: 'Maria Santos'
      });
      setIssueSubmitted(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 bg-slate-50 text-slate-900 pb-20 select-none">
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to History</span>
          </button>
          <span className="text-xs font-mono text-slate-400">{ride.ride_id}</span>
        </div>

        <div>
          <h1 className="text-xl font-black text-slate-900">Ride Details</h1>
          <p className="text-xs text-slate-500">Official verified tricycle ride record</p>
        </div>

        {/* Section 13 Specification Details Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Bike className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vehicle</div>
                <div className="font-mono text-xl font-black text-slate-900">{ride.vehicle_id}</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Completed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <User className="w-3.5 h-3.5" /> Driver
              </span>
              <div className="font-bold text-slate-800">{ride.driver_name}</div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {ride.driver_id}</div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5" /> Pickup Area
              </span>
              <div className="font-bold text-slate-800">{ride.approximate_location || 'Tagum City'}</div>
              <div className="text-[10px] text-slate-400">Approximate Location</div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Calendar className="w-3.5 h-3.5" /> Date
              </span>
              <div className="font-bold text-slate-800">{formattedDate}</div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5" /> Time
              </span>
              <div className="font-bold text-slate-800">{formattedTime}</div>
            </div>
          </div>

          {/* Payment Row */}
          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Payment</span>
              <div className="text-sm font-bold text-slate-900 capitalize">
                {ride.payment_method === 'digital' ? '₱' + (ride.fare_amount || 30) + ' Digital' : 'Cash / Ride Check-In'}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-600">
                {ride.payment_method === 'digital' ? 'QR Ph Verified' : 'Voluntary Log'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 13 Available Actions */}
        <div className="space-y-2.5 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Actions</div>

          {/* Action 1: Report Lost Item */}
          <button
            onClick={onReportLostItem}
            className="w-full p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-left transition shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Report Lost Item</div>
                <div className="text-[11px] text-slate-500">
                  Notify driver Juan D. about a forgotten phone, wallet, bag, or keys
                </div>
              </div>
            </div>
          </button>

          {/* Action 2: Report Ride Issue / Payment Problem */}
          <button
            onClick={() => setShowIssueModal(true)}
            className="w-full p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-left transition shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Report Ride Issue / Payment Problem</div>
                <div className="text-[11px] text-slate-500">
                  Paid twice, incorrect amount, or payment deducted without confirmation
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Ride Issue / Refund Ticket Modal (Section 21) */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            {issueSubmitted ? (
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Issue Submitted</h3>
                <p className="text-xs text-slate-500">
                  Ticket logged for review. TalaRide support will verify with payment gateway and coordinate with the operator.
                </p>
                <button
                  onClick={() => {
                    setShowIssueModal(false);
                    setIssueSubmitted(false);
                  }}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportIssue} className="space-y-3">
                <h3 className="font-bold text-base text-slate-900">Report Payment Problem</h3>
                <p className="text-xs text-slate-500">
                  Select the issue you experienced with ride {ride.ride_id}:
                </p>

                <div className="space-y-2">
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                  >
                    <option value="paid_twice">Paid twice</option>
                    <option value="wrong_amount">Wrong amount</option>
                    <option value="deducted_no_driver_confirm">Deducted but driver did not receive</option>
                    <option value="incorrect_custom_fare">Incorrect custom fare</option>
                    <option value="other">Other issue</option>
                  </select>

                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details or payment reference..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
