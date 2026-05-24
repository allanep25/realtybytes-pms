import { formatPHP } from "@/lib/format";
import type { StayQuote } from "@/lib/stay-pricing";

type StayBillingSummaryProps = {
  quote: StayQuote | null;
  roomNumber?: string;
};

export function StayBillingSummary({ quote, roomNumber }: StayBillingSummaryProps) {
  if (!quote) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Select check-in and check-out dates to see the estimated total.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <h4 className="text-sm font-semibold text-slate-800">Billing Summary</h4>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">
            Room stay — {quote.nights} night{quote.nights !== 1 ? "s" : ""} ×{" "}
            {formatPHP(quote.nightlyRate)}
          </dt>
          <dd className="font-medium text-slate-800">{formatPHP(quote.baseStayTotal)}</dd>
        </div>

        {quote.extensionDays > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">
              Day extension — {quote.extensionDays} day
              {quote.extensionDays !== 1 ? "s" : ""} × {formatPHP(quote.nightlyRate)}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatPHP(quote.extensionDaysTotal)}
            </dd>
          </div>
        )}

        {quote.extensionHours > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">
              Hour extension — {quote.extensionHours} hr
              {quote.extensionHours !== 1 ? "s" : ""} × {formatPHP(quote.hourlyExtensionRate)}
            </dt>
            <dd className="font-medium text-slate-800">
              {formatPHP(quote.extensionHoursTotal)}
            </dd>
          </div>
        )}

        {quote.extensionHours > 0 && (
          <p className="text-xs text-slate-500">
            Hourly rate{roomNumber ? ` (Room ${roomNumber})` : ""}: nightly rate ÷ 24 + 20% ={" "}
            {formatPHP(quote.hourlyExtensionRate)}/hr
          </p>
        )}

        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
          <dt className="font-semibold text-slate-800">Total Due</dt>
          <dd className="text-lg font-bold text-room-occupied">{formatPHP(quote.totalDue)}</dd>
        </div>
      </dl>
    </div>
  );
}
