import { env } from '../env.js';

export interface PayMongoCheckoutOptions {
  paymentId: string;
  rideId: string;
  vehicleCode: string;
  driverCode: string;
  amountCentavos: number;
  paymentMethod?: 'gcash' | 'maya' | 'card' | 'qrph';
  description?: string;
}

export interface PayMongoCheckoutResult {
  checkoutSessionId: string;
  checkoutUrl: string;
  qrPayload?: string;
}

export interface PayMongoDirectGcashResult {
  paymentIntentId: string;
  paymentMethodId: string;
  redirectUrl: string;
}

function getPayMongoAuthHeader() {
  const secretKey = env.PAYMENT_PROVIDER_KEY;
  if (!secretKey || secretKey.startsWith('replace_me')) {
    throw new Error('PAYMENT_PROVIDER_KEY is not configured with PayMongo secret key (sk_test_...)');
  }
  return 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
}

/**
 * Creates a direct GCash payment flow using PayMongo PaymentIntent + PaymentMethod.
 * The amount is locked on the server before PayMongo returns the provider redirect URL.
 */
export async function createPayMongoDirectGcash(
  options: PayMongoCheckoutOptions
): Promise<PayMongoDirectGcashResult> {
  const authHeader = getPayMongoAuthHeader();
  const publicWebOrigin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, '');

  const metadata = {
    payment_id: options.paymentId,
    ride_id: options.rideId,
    vehicle_code: options.vehicleCode,
    driver_code: options.driverCode,
    selected_payment_method: 'gcash'
  };

  const intentResponse = await fetch('https://api.paymongo.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: options.amountCentavos,
          payment_method_allowed: ['gcash'],
          payment_method_options: {},
          currency: 'PHP',
          capture_type: 'automatic',
          description: `TalaRide fare for ${options.vehicleCode} | ${options.paymentId}`,
          statement_descriptor: 'TALARIDE',
          metadata
        }
      }
    })
  });

  const intentBody = (await intentResponse.json()) as any;
  if (!intentResponse.ok) {
    const errorMsg = intentBody?.errors?.[0]?.detail || intentResponse.statusText;
    throw new Error(`PayMongo GCash intent error: ${errorMsg}`);
  }

  const intent = intentBody.data;
  const clientKey = intent?.attributes?.client_key;
  if (!intent?.id || !clientKey) {
    throw new Error('PayMongo GCash intent did not return an id/client_key');
  }

  const methodResponse = await fetch('https://api.paymongo.com/v1/payment_methods', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: 'gcash',
          billing: {
            name: `Passenger of ${options.vehicleCode}`,
            email: 'commuter@talaride.ph',
            phone: '09170000000'
          }
        }
      }
    })
  });

  const methodBody = (await methodResponse.json()) as any;
  if (!methodResponse.ok) {
    const errorMsg = methodBody?.errors?.[0]?.detail || methodResponse.statusText;
    throw new Error(`PayMongo GCash payment method error: ${errorMsg}`);
  }

  const paymentMethodId = methodBody?.data?.id;
  if (!paymentMethodId) {
    throw new Error('PayMongo GCash payment method did not return an id');
  }

  const attachResponse = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${intent.id}/attach`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: paymentMethodId,
            client_key: clientKey,
            return_url: `${publicWebOrigin}/success?payment_id=${encodeURIComponent(options.paymentId)}`
          }
        }
      })
    }
  );

  const attachBody = (await attachResponse.json()) as any;
  if (!attachResponse.ok) {
    const errorMsg = attachBody?.errors?.[0]?.detail || attachResponse.statusText;
    throw new Error(`PayMongo GCash attach error: ${errorMsg}`);
  }

  const attached = attachBody.data;
  const redirectUrl =
    attached?.attributes?.next_action?.redirect?.url ||
    attached?.attributes?.next_action?.redirect_url;

  if (!redirectUrl) {
    throw new Error('PayMongo GCash flow did not return a provider redirect URL');
  }

  return {
    paymentIntentId: intent.id,
    paymentMethodId,
    redirectUrl
  };
}

/**
 * Creates a PayMongo Checkout Session for GCash, Maya, and QR Ph payments.
 */
export async function createPayMongoCheckout(
  options: PayMongoCheckoutOptions
): Promise<PayMongoCheckoutResult> {
  const authHeader = getPayMongoAuthHeader();

  const publicWebOrigin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, '');
  const paymentMethodMap = {
    gcash: 'gcash',
    maya: 'paymaya',
    card: 'card',
    qrph: 'qrph'
  } as const;
  const selectedPaymentMethod = options.paymentMethod
    ? [paymentMethodMap[options.paymentMethod]]
    : ['gcash', 'paymaya', 'qrph', 'card'];

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
        payment_method_types: selectedPaymentMethod,
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
          driver_code: options.driverCode,
          selected_payment_method: options.paymentMethod || 'any'
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
