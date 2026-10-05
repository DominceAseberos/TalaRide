import React from 'react';
import { X, ShieldAlert, AlertTriangle, FileText, Lock, Award, MapPin } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DisclaimersModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-lg">Terms, Safety & Disclaimers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
          {/* Section 30 & 31: Safety & Emergency */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Safety & Emergency Disclaimer</span>
            </div>
            <p className="text-amber-800 text-xs">
              <strong>TalaRide does not guarantee personal safety.</strong> TalaRide’s ride-recording features are intended to provide additional ride information and records. They do not guarantee personal safety, prevent crime, or replace emergency services, law enforcement, or other appropriate authorities.
            </p>
            <p className="text-amber-800 text-xs font-medium">
              🚨 <strong>Emergency:</strong> TalaRide is not an emergency response service. If you are in immediate danger or experiencing an emergency, dial 911 or contact local Tagum City PNP authorities immediately.
            </p>
          </div>

          {/* Section 29: Payments & Verification */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              Payment & Confirmation Policy
            </h3>
            <p className="text-xs">
              TalaRide facilitates digital payments via QR Ph through licensed third-party e-wallets (GCash, Maya, GoTyme) and participating banks. TalaRide never asks for or stores user banking passwords, card PINs, or MPINs.
            </p>
            <p className="text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              ⚠️ Official Server Verification: A payment is considered successful only after TalaRide receives confirmation from its payment provider. Screenshots or text messages presented on another device are not proof of payment within TalaRide.
            </p>
          </div>

          {/* Section 29: Cash Rides */}
          <div className="space-y-1">
            <h4 className="font-medium text-slate-800 text-xs">Cash Transactions</h4>
            <p className="text-xs text-slate-500">
              Cash payments are transactions directly between the commuter and the driver. TalaRide does not process or hold physical cash. Commuters are encouraged to scan the tricycle vehicle sticker to log a voluntary ride check-in record.
            </p>
          </div>

          {/* Section 29: Fare Disclaimer */}
          <div className="space-y-1">
            <h4 className="font-medium text-slate-800 text-xs">Fares & Special Trips</h4>
            <p className="text-xs text-slate-500">
              TalaRide displays fares entered or configured for participating drivers and TODA operators. TalaRide does not independently determine government-regulated transportation fares. Custom or special-trip fares must be agreed upon between commuter and driver before payment.
            </p>
          </div>

          {/* Section 32 & 33: Driver Identity & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-medium text-slate-800 text-xs flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Driver Identity
              </span>
              <p className="text-[11px] text-slate-500">
                Driver and vehicle records reflect data recorded in the TODA system and active shift logs. Passengers should exercise standard caution before boarding.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-medium text-slate-800 text-xs flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-600" />
                Approximate Location
              </span>
              <p className="text-[11px] text-slate-500">
                Location data is approximate and subject to device GPS accuracy and permissions. TalaRide does not continuously track live vehicle GPS.
              </p>
            </div>
          </div>

          {/* Section 34: Lost Items */}
          <div className="space-y-1">
            <h4 className="font-medium text-slate-800 text-xs">Lost Item Assistance</h4>
            <p className="text-xs text-slate-500">
              TalaRide assists users in identifying and contacting the assigned driver or TODA operator regarding lost items. However, TalaRide cannot guarantee that an item will be found, recovered, or returned.
            </p>
          </div>

          {/* Section 35: Rewards */}
          <div className="space-y-1">
            <h4 className="font-medium text-slate-800 text-xs flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              TalaRide Rewards
            </h4>
            <p className="text-xs text-slate-500">
              TalaPoints and promotional vouchers are subject to eligibility, minimum fare requirements, and expiration dates. Rewards have no independent cash value and cannot be exchanged for cash.
            </p>
          </div>

          {/* Section 38: Privacy Notice */}
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-emerald-950">
            <strong>Privacy Notice (Data Privacy Act of 2012 Compliance):</strong> TalaRide collects minimal data: mobile number and voluntary ride check-in logs solely to deliver payment confirmations, safety records, and lost-item recovery assistance. Data is not sold or shared with advertisers.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
