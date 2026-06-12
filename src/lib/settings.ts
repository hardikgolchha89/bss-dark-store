// Admin-editable settings & feature flags. Stored in the Setting table (key/value
// strings), toggled live by an admin, applied globally for every user.

export type SettingKey =
  | "erpnext_export_enabled"
  | "rebel_export_enabled"
  | "cz_export_enabled"
  | "block_finalize_on_unmapped"
  | "show_possible_revenue_kpi"
  | "sheets_sync_enabled"
  | "erpnext_source_warehouse"
  | "sheets_spreadsheet_id"
  | "sheets_tab_name";

export type SettingType = "bool" | "string";

export interface SettingDef {
  key: SettingKey;
  label: string;
  type: SettingType;
  default: string;
  group: "Exports" | "Run" | "Display" | "Sheets" | "ERPNext";
  help?: string;
}

// Note the DOUBLE SPACE before "- HIHPL" — ERPNext matches warehouse names literally.
export const ERPNEXT_DEFAULT_SOURCE = "Andheri Dark Store Ops  - HIHPL";

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "erpnext_export_enabled",
    label: "ERPNext export",
    type: "bool",
    default: "true",
    group: "Exports",
    help: "Enable the ERPNext Stock Entry (Material Transfer) CSV export.",
  },
  {
    key: "cz_export_enabled",
    label: "CZ PO export",
    type: "bool",
    default: "true",
    group: "Exports",
  },
  {
    key: "rebel_export_enabled",
    label: "Rebel PO export",
    type: "bool",
    default: "false",
    group: "Exports",
    help: "Off until Rebel SKU codes are mapped.",
  },
  {
    key: "block_finalize_on_unmapped",
    label: "Block finalize when unmapped SKUs exist",
    type: "bool",
    default: "false",
    group: "Run",
    help: "Off = warn loudly but allow finalize. On = hard gate.",
  },
  {
    key: "show_possible_revenue_kpi",
    label: "Show possible-revenue KPI",
    type: "bool",
    default: "true",
    group: "Display",
    help: "Header total = Σ adjusted qty × MRP.",
  },
  {
    key: "sheets_sync_enabled",
    label: "Google Sheets sync button",
    type: "bool",
    default: "false",
    group: "Sheets",
    help: "Manual push of the item master to a Google Sheet. Needs creds.",
  },
  {
    key: "erpnext_source_warehouse",
    label: "ERPNext source warehouse (s_warehouse)",
    type: "string",
    default: ERPNEXT_DEFAULT_SOURCE,
    group: "ERPNext",
    help: "The warehouse stock transfers FROM on every line.",
  },
  {
    key: "sheets_spreadsheet_id",
    label: "Google Sheet ID",
    type: "string",
    default: "",
    group: "Sheets",
  },
  {
    key: "sheets_tab_name",
    label: "Google Sheet tab name",
    type: "string",
    default: "Item Master",
    group: "Sheets",
  },
];

export function defaultsByKey(): Record<string, string> {
  return Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.default]));
}

export function asBool(value: string | undefined | null): boolean {
  return value === "true" || value === "1";
}
