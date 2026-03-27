export type BackNavigationSourceConfig = {
  href: string;
  label: string;
  allowedPrefixes?: readonly string[];
};

type ResolveBackNavigationOptions = {
  source?: string | null;
  returnTo?: string | null;
  fallbackHref: string;
  fallbackLabel: string;
  allowedPrefixes?: readonly string[];
  sourceMap?: Record<string, BackNavigationSourceConfig>;
};

function normalizeInternalPath(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed;
}

function matchesAllowedPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}?`) || pathname.startsWith(`${prefix}/`);
}

export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeReturnTo(rawValue: string | null | undefined, allowedPrefixes: readonly string[]) {
  if (!rawValue) {
    return null;
  }

  const normalizedPath = normalizeInternalPath(rawValue);
  if (!normalizedPath) {
    return null;
  }

  return allowedPrefixes.some((prefix) => matchesAllowedPrefix(normalizedPath, prefix))
    ? normalizedPath
    : null;
}

export function resolveBackNavigation(options: ResolveBackNavigationOptions) {
  const normalizedSource = options.source?.trim() || null;
  const sourceConfig = normalizedSource ? options.sourceMap?.[normalizedSource] : undefined;
  const allowedPrefixes = [
    ...(options.allowedPrefixes ?? []),
    ...(sourceConfig?.allowedPrefixes ?? []),
  ];
  const safeReturnTo = sanitizeReturnTo(options.returnTo, allowedPrefixes);

  if (safeReturnTo) {
    return {
      href: safeReturnTo,
      label: sourceConfig?.label ?? options.fallbackLabel,
    };
  }

  if (sourceConfig) {
    return {
      href: sourceConfig.href,
      label: sourceConfig.label,
    };
  }

  return {
    href: options.fallbackHref,
    label: options.fallbackLabel,
  };
}

export function buildReturnTo(pathname: string, searchParams?: URLSearchParams | { toString(): string } | string | null) {
  if (!searchParams) {
    return pathname;
  }

  const serialized =
    typeof searchParams === "string"
      ? searchParams.replace(/^\?/, "")
      : searchParams.toString();

  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function appendBackNavigationToHref(
  href: string,
  options: {
    source?: string | null;
    returnTo?: string | null;
  },
) {
  const base = new URL(href, "http://sumtrack.local");

  if (options.source?.trim()) {
    base.searchParams.set("source", options.source.trim());
  }

  const safeReturnTo = normalizeInternalPath(options.returnTo ?? "");
  if (safeReturnTo) {
    base.searchParams.set("returnTo", safeReturnTo);
  }

  return `${base.pathname}${base.search}${base.hash}`;
}
