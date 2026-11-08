import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck, Delete, KeyRound } from 'lucide-react';
import { backupSecurityService } from '../../services/backupSecurityService';

interface PinLockGateProps {
  pinEnabled: boolean;
  autoLockMinutes: number;
  isLocked: boolean;
  onUnlock: () => void;
  onLockNow: () => void;
  children: React.ReactNode;
}

export const PinLockGate: React.FC<PinLockGateProps> = ({
  pinEnabled,
  autoLockMinutes,
  isLocked,
  onUnlock,
  onLockNow,
  children,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (!pinEnabled || isLocked) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    const timeoutMs = Math.max(1, autoLockMinutes || 5) * 60 * 1000;
    timerRef.current = window.setTimeout(() => {
      onLockNow();
    }, timeoutMs);
  }, [pinEnabled, isLocked, autoLockMinutes, onLockNow]);

  useEffect(() => {
    if (!pinEnabled || isLocked) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      return;
    }

    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [pinEnabled, isLocked, resetInactivityTimer]);

  const handleVerifyPin = async (pinToTest: string) => {
    if (pinToTest.length < 4) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const ok = await backupSecurityService.verifyPin(pinToTest);
      if (ok) {
        setEnteredPin('');
        onUnlock();
      } else {
        setErrorMsg('Incorrect PIN. Please try again.');
        setEnteredPin('');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDigitPress = (digit: string) => {
    if (enteredPin.length >= 6) return;
    const next = enteredPin + digit;
    setEnteredPin(next);
    setErrorMsg(null);
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  if (!pinEnabled || !isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 select-none">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <Lock className="h-7 w-7" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-white">My Money Tracker Locked</h1>
          <p className="mt-1 text-xs text-slate-400">
            Enter your 4 to 6 digit local security PIN to access your financial records
          </p>
        </div>

        {/* Masked PIN Dots */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerifyPin(enteredPin);
          }}
          className="space-y-4"
        >
          <div className="flex justify-center gap-2.5 py-2">
            {Array.from({ length: Math.max(4, enteredPin.length) }).map((_, idx) => {
              const filled = idx < enteredPin.length;
              return (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full transition-all ${
                    filled
                      ? 'bg-emerald-400 scale-110 shadow-sm shadow-emerald-500/50'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                />
              );
            })}
          </div>

          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={enteredPin}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
              setEnteredPin(digitsOnly);
              setErrorMsg(null);
            }}
            placeholder="Enter PIN"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-center text-sm tracking-widest text-white focus:border-emerald-500 focus:outline-none"
          />

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
          )}

          {/* Mobile Touch Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitPress(digit)}
                className="rounded-2xl bg-slate-800/90 hover:bg-slate-800 active:bg-emerald-600 py-3 text-base font-bold text-white transition cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEnteredPin('')}
              className="rounded-2xl bg-slate-800/60 hover:bg-slate-800 py-3 text-xs font-semibold text-slate-400 cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              className="rounded-2xl bg-slate-800/90 hover:bg-slate-800 active:bg-emerald-600 py-3 text-base font-bold text-white transition cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="flex items-center justify-center rounded-2xl bg-slate-800/60 hover:bg-slate-800 py-3 text-slate-300 cursor-pointer"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <button
            type="submit"
            disabled={enteredPin.length < 4 || verifying}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 py-3 text-xs font-bold text-slate-950 transition cursor-pointer"
          >
            <KeyRound className="h-4 w-4" />
            <span>{verifying ? 'Verifying PIN...' : 'Unlock Application'}</span>
          </button>
        </form>

        <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 text-left flex items-start gap-2.5 text-[11px] text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Auto-locks after <strong>{autoLockMinutes} min</strong> of inactivity. Note: Local PIN
            lock restricts UI access on this device; use encrypted JSON backups in Settings for
            off-device data protection.
          </span>
        </div>
      </div>
    </div>
  );
};
