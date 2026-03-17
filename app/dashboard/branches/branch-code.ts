export function normalizeBranchCodeInput(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function buildBranchCode(provinceCode: string, municipalityCode: string) {
  const normalizedProvinceCode = normalizeBranchCodeInput(provinceCode);
  const normalizedMunicipalityCode = normalizeBranchCodeInput(municipalityCode);

  if (!normalizedProvinceCode || !normalizedMunicipalityCode) {
    return "";
  }

  return `${normalizedProvinceCode}-${normalizedMunicipalityCode}`;
}
