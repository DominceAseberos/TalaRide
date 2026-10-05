import { Copy } from './ui';

// Short MVP disclaimers (§§29-38). Full legal text ships pre-launch after counsel review.
export function PaymentDisclaimer() {
  return (
    <Copy style={{ fontSize: 12 }}>
      Paid only after TalaRide provider confirmation. Screenshots are not proof. Cash rides are
      directly between commuter and driver. Fares shown are driver/operator-entered; confirm custom
      fares before paying.
    </Copy>
  );
}

export function SafetyDisclaimer() {
  return (
    <Copy style={{ fontSize: 12 }}>
      Ride records aid lost-item help; they do not guarantee safety. Not an emergency service —
      contact local authorities in danger. Location is approximate.
    </Copy>
  );
}

export function RewardsDisclaimer() {
  return (
    <Copy style={{ fontSize: 12 }}>
      Rewards need eligible confirmed digital rides, limits and expiry apply. No cash value unless
      stated. Some features need internet; confirmations may delay offline.
    </Copy>
  );
}
