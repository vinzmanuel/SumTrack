"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type LoginPasswordFieldProps = {
  id: string;
  name: string;
  placeholder: string;
};

export function LoginPasswordField({
  id,
  name,
  placeholder,
}: LoginPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className="block w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-4 pr-12 text-white shadow-inner outline-none transition-all placeholder:text-white/20 focus:border-[#d94f1e] focus:ring-1 focus:ring-[#d94f1e] sm:text-sm"
        id={id}
        name={name}
        placeholder={placeholder}
        required
        type={isVisible ? "text" : "password"}
      />
      <button
        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-white/40 transition-colors hover:text-white"
        type="button"
        onClick={() => setIsVisible((current) => !current)}
      >
        {isVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
