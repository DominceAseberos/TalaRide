import { env } from '../env.js';

export interface PayMongoCheckoutOptions {
  paymentId: string;
  rideId: string;
  vehicleCode: string;
  driverCode: string;
  amountCentavos: number;
  description?: string;
}

export interface PayMongoCheckoutResult {
  checkoutSessionId: string;
  checkoutUrl: string;
  qrPayload?: string;
}

/**
 * Creates a PayMongo Checkout Session for GCash, Maya, and QR Ph payments.
 */
export async function createPayMongoCheckout(
  options: PayMongoCheckoutOptions
): Promise<PayMongoCheckoutResult> {
  const secretKey = env.PAYMENT_PROVIDER_KEY;
  if (!secretKey || secretKey.startsWith('replace_me')) {
    throw new Error('PAYMENT_PROVIDER_KEY is not configured with PayMongo secret key (sk_test_...)');
  }

  const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

  const publicWebOrigin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, '');

  const payload = {
    data: {
      attributes: {
        billing: {
          name: `Passenger of ${options.vehicleCode}`,
          email: 'commuter@talaride.ph',
          phone: '09170000000'
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        cancel_url: `${publicWebOrigin}/cancel?payment_id=${encodeURIComponent(options.paymentId)}`,
        success_url: `${publicWebOrigin}/success?payment_id=${encodeURIComponent(options.paymentId)}`,
        description: `TalaRide fare for ${options.vehicleCode} (Ride #${options.rideId})`,
        payment_method_types: ['gcash', 'paymaya', 'qrph', 'card'],
        reference_number: options.paymentId,
        line_items: [
          {
            currency: 'PHP',
            amount: options.amountCentavos,
            name: `TalaRide Tricycle Fare — ${options.vehicleCode}`,
            quantity: 1,
            description: `Driver ${options.driverCode} | ${options.paymentId}`
          }
        ],
        metadata: {
          payment_id: options.paymentId,
          ride_id: options.rideId,
          vehicle_code: options.vehicleCode,
          driver_code: options.driverCode
        }
      }
    }
  };

  const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as any;
  if (!response.ok) {
    const errorMsg = body?.errors?.[0]?.detail || response.statusText;
    throw new Error(`PayMongo API error: ${errorMsg}`);
  }

  const session = body.data;
  return {
    checkoutSessionId: session.id,
    checkoutUrl: session.attributes.checkout_url
  };
}
