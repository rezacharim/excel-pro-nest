"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

export interface LeagueSeasonSettings {
  id: number;
  name: string;
  feeTotal: number;
  feeLate: number;
  feePayInFull: number | null;
  firstPaymentDue: string | null;
  secondPaymentDue: string | null;
  lateFeeFrom: string | null;
  capacityPerGroup: number;
  registrationOpen: boolean;
  installmentCount: number;
}

export interface SeasonSettingsPayload {
  /**
   * Always sent, even when unchanged. The PATCH route validates the body
   * against the full create-season DTO, where name is the one required
   * field — leaving it out fails with "name must be a string".
   */
  name: string;
  feeTotal?: number;
  feeLate?: number;
  firstPaymentDue?: string;
  secondPaymentDue?: string;
  lateFeeFrom?: string;
  capacityPerGroup?: number;
  registrationOpen?: boolean;
}

const dateOnly = (iso: string | null) => (iso ? String(iso).slice(0, 10) : "");

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The season's fees, deadlines and capacity.
 *
 * Every one of these used to require a developer, which is how a late fee
 * came to start on 25 August while the registration deadline was still being
 * extended: the date was right when it was set weeks earlier, and there was
 * no way to move it when the plan changed.
 *
 * The late-fee date is the one that actually decides the price, so it is
 * shown with what it currently means rather than as a bare date field.
 */
const SeasonSettingsDialog = ({
  season,
  open,
  onCancel,
  onSubmit,
}: {
  season: LeagueSeasonSettings | null;
  open: boolean;
  onCancel: () => void;
  onSubmit: (payload: SeasonSettingsPayload) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [feeTotal, setFeeTotal] = useState("");
  const [feeLate, setFeeLate] = useState("");
  const [firstDue, setFirstDue] = useState("");
  const [secondDue, setSecondDue] = useState("");
  const [lateFrom, setLateFrom] = useState("");
  const [capacity, setCapacity] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !season) return;
    setName(season.name ?? "");
    setFeeTotal(String(season.feeTotal ?? ""));
    setFeeLate(String(season.feeLate ?? ""));
    setFirstDue(dateOnly(season.firstPaymentDue));
    setSecondDue(dateOnly(season.secondPaymentDue));
    // Falls back to the payment deadline, which is exactly what the server
    // does when it is not set — showing it blank would hide the real rule.
    setLateFrom(
      dateOnly(season.lateFeeFrom) || dateOnly(season.firstPaymentDue)
    );
    setCapacity(String(season.capacityPerGroup ?? ""));
    setRegistrationOpen(season.registrationOpen);
    setError(null);
  }, [open, season]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!open || !season) return null;

  const lateActive = Boolean(lateFrom && todayLocal() > lateFrom);
  const priceNow = lateActive ? Number(feeLate) : Number(feeTotal);

  const save = async () => {
    if (!name.trim()) {
      setError("The season needs a name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        feeTotal: Number(feeTotal) || 0,
        feeLate: Number(feeLate) || 0,
        firstPaymentDue: firstDue || undefined,
        secondPaymentDue: secondDue || undefined,
        lateFeeFrom: lateFrom || undefined,
        capacityPerGroup: Number(capacity) || 0,
        registrationOpen,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the season");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
  };

  const field =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E43125]/30 focus:border-[#E43125]";
  const label = "block text-xs font-semibold text-gray-700 mb-1";
  const section =
    "mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-4 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Season settings</h2>
            <p className="mt-0.5 text-sm text-gray-600">{season.name}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* What a family registering right now would actually be charged.
              This is the number the whole screen exists to control. */}
          <div
            className={`rounded-xl p-4 ${
              lateActive
                ? "border border-amber-200 bg-amber-50"
                : "border border-green-200 bg-green-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Someone registering today pays
            </p>
            <p
              className={`mt-0.5 text-2xl font-extrabold ${
                lateActive ? "text-amber-900" : "text-green-800"
              }`}
            >
              ${priceNow.toLocaleString("en-CA")}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {lateActive
                ? `The late fee started on ${lateFrom}. Move that date forward to go back to $${Number(feeTotal).toLocaleString("en-CA")}.`
                : `The standard fee applies until ${lateFrom || "the payment deadline"}.`}
            </p>
          </div>

          <div>
            <p className={section}>Season</p>
            <label className={label} htmlFor="s-name">
              Name
            </label>
            <input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <p className={section}>Fees</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="s-fee">
                  Standard fee
                </label>
                <input
                  id="s-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeTotal}
                  onChange={(e) => setFeeTotal(e.target.value)}
                  className={field}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Split into {season.installmentCount} payment
                  {season.installmentCount === 1 ? "" : "s"} of $
                  {(Number(feeTotal) / (season.installmentCount || 1)).toFixed(
                    2
                  )}
                </p>
              </div>
              <div>
                <label className={label} htmlFor="s-late">
                  Late fee
                </label>
                <input
                  id="s-late"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeLate}
                  onChange={(e) => setFeeLate(e.target.value)}
                  className={field}
                />
              </div>
            </div>
          </div>

          <div>
            <p className={section}>Dates</p>
            <div className="space-y-3">
              <div>
                <label className={label} htmlFor="s-latefrom">
                  Late fee starts
                </label>
                <input
                  id="s-latefrom"
                  type="date"
                  value={lateFrom}
                  onChange={(e) => setLateFrom(e.target.value)}
                  className={field}
                />
                <p className="mt-1 text-xs text-gray-500">
                  This is the date that decides the price. Extending the
                  deadline means moving this.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="s-first">
                    1st payment due
                  </label>
                  <input
                    id="s-first"
                    type="date"
                    value={firstDue}
                    onChange={(e) => setFirstDue(e.target.value)}
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="s-second">
                    2nd payment due
                  </label>
                  <input
                    id="s-second"
                    type="date"
                    value={secondDue}
                    onChange={(e) => setSecondDue(e.target.value)}
                    className={field}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className={section}>Places</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="s-cap">
                  Spots per age group
                </label>
                <input
                  id="s-cap"
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={field}
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                />
                <span>Registration is open</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Closing registration stops the public form. You can still add
              players from this dashboard.
            </p>
          </div>

          {/* Said plainly because it is the question every one of these edits
              raises, and guessing wrong about it costs money. */}
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Changing anything here affects <strong>new</strong> registrations
            only. Players already registered keep the fee and dates they signed
            up with — use <strong>Edit</strong> on their row to change those.
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-5">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E43125] px-5 py-2 text-sm font-semibold text-white hover:bg-[#c4291f] disabled:opacity-50"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" />}
            Save season
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeasonSettingsDialog;
