import { apiRequest } from './client';

export async function reportLostItem(input: {
  ride_id: string;
  category: string;
  description: string;
  client_operation_id: string;
}) {
  const data = await apiRequest<{ report: { report_id: string; status: string } }>(
    '/lost-item-report',
    {
      method: 'POST',
      body: JSON.stringify({
        ride_id: input.ride_id,
        item_category: input.category.toLowerCase(),
        description: input.description,
        client_operation_id: input.client_operation_id,
      }),
    },
  );
  return { report_id: data.report.report_id, status: data.report.status };
}

export async function reportPaymentIssue(input: {
  payment_id?: string;
  ride_id?: string;
  reason: string;
  details?: string;
  client_operation_id: string;
}) {
  const allowed = new Set([
    'paid_twice',
    'wrong_amount',
    'deducted_no_driver_confirm',
    'incorrect_custom_fare',
    'other',
  ]);
  const issue_type = allowed.has(input.reason) ? input.reason : 'other';
  const data = await apiRequest<{ ticket: { ticket_id: string; status: string } }>(
    '/payment-issue',
    {
      method: 'POST',
      body: JSON.stringify({
        payment_id: input.payment_id,
        ride_id: input.ride_id,
        issue_type,
        description: input.details || input.reason,
        client_operation_id: input.client_operation_id,
      }),
    },
  );
  return { issue_id: data.ticket.ticket_id, status: data.ticket.status };
}
