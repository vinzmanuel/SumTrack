"use client";

import * as React from "react";

type OtpCodeInputProps = {
  id?: string;
  name: string;
  length?: number;
  label?: string;
};

function sanitizeOtpValue(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

export function OtpCodeInput({
  id = "code",
  name,
  length = 6,
  label = "Verification Code",
}: OtpCodeInputProps) {
  const [value, setValue] = React.useState("");
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ""),
    [length, value],
  );

  const focusIndex = React.useCallback((index: number) => {
    const target = inputRefs.current[index];
    if (!target) {
      return;
    }

    target.focus();
    target.select();
  }, []);

  const updateValue = React.useCallback(
    (nextValue: string) => {
      setValue(sanitizeOtpValue(nextValue, length));
    },
    [length],
  );

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-white/80" htmlFor={id}>
        {label}
      </label>

      <input name={name} type="hidden" value={value} />

      <div className="flex justify-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            className="h-10 w-10 rounded-lg border border-white/10 bg-slate-950 text-center text-base font-semibold text-white shadow-inner outline-none transition-all placeholder:text-white/20 focus:border-[#d94f1e] focus:ring-1 focus:ring-[#d94f1e] sm:h-11 sm:w-11 sm:text-lg"
            id={index === 0 ? id : undefined}
            inputMode="numeric"
            maxLength={1}
            onChange={(event) => {
              const rawInput = event.target.value;
              const sanitizedInput = sanitizeOtpValue(rawInput, length);

              if (!sanitizedInput) {
                const nextDigits = [...digits];
                nextDigits[index] = "";
                updateValue(nextDigits.join(""));
                return;
              }

              if (sanitizedInput.length > 1) {
                const paddedDigits = [...digits];
                for (
                  let sourceIndex = 0;
                  sourceIndex < sanitizedInput.length && index + sourceIndex < length;
                  sourceIndex += 1
                ) {
                  paddedDigits[index + sourceIndex] = sanitizedInput[sourceIndex];
                }

                const nextValue = paddedDigits.join("").slice(0, length);
                updateValue(nextValue);
                const nextFocusIndex = Math.min(index + sanitizedInput.length, length - 1);
                focusIndex(nextFocusIndex);
                return;
              }

              const nextDigits = [...digits];
              nextDigits[index] = sanitizedInput;
              updateValue(nextDigits.join(""));

              if (index < length - 1) {
                focusIndex(index + 1);
              }
            }}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                if (digits[index]) {
                  const nextDigits = [...digits];
                  nextDigits[index] = "";
                  updateValue(nextDigits.join(""));
                  event.preventDefault();
                  return;
                }

                if (index > 0) {
                  const nextDigits = [...digits];
                  nextDigits[index - 1] = "";
                  updateValue(nextDigits.join(""));
                  focusIndex(index - 1);
                  event.preventDefault();
                }
                return;
              }

              if (event.key === "ArrowLeft" && index > 0) {
                focusIndex(index - 1);
                event.preventDefault();
                return;
              }

              if (event.key === "ArrowRight" && index < length - 1) {
                focusIndex(index + 1);
                event.preventDefault();
              }
            }}
            onPaste={(event) => {
              const pasted = sanitizeOtpValue(event.clipboardData.getData("text"), length);
              if (!pasted) {
                return;
              }

              updateValue(pasted);
              focusIndex(Math.min(pasted.length - 1, length - 1));
              event.preventDefault();
            }}
            pattern="[0-9]*"
            placeholder=""
            required={index === 0}
            type="text"
            value={digit}
          />
        ))}
      </div>
    </div>
  );
}
