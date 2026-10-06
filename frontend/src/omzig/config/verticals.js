/**
 * Omzig industry verticals — Omzig Custom CIPP Build v1.1 §1 / §14.
 * Each vertical maps to a GDAP role bundle preset in src/omzig/gdap-bundles/.
 */

export const OMZIG_VERTICALS = [
  { id: 'healthcare', label: 'Healthcare', gdapBundle: 'Healthcare-HIPAA', baaDefault: true },
  { id: 'legal', label: 'Legal', gdapBundle: 'Legal-Ethics', baaDefault: true },
  { id: 'wealth', label: 'Wealth Management', gdapBundle: 'Wealth-SEC', baaDefault: true },
  { id: 'cpa', label: 'CPAs / Accounting', gdapBundle: 'Wealth-SEC', baaDefault: true },
  { id: 'title', label: 'Title', gdapBundle: 'Title-ALTA', baaDefault: true },
  { id: 'hospitality', label: 'Hospitality', gdapBundle: 'Hospitality', baaDefault: true },
  {
    id: 'family-office',
    label: 'Family Office',
    gdapBundle: 'FamilyOffice-Financial',
    baaDefault: true, // treated as a financial institution
  },
  { id: 'other', label: 'Professional Services / Other', gdapBundle: null, baaDefault: true },
]

// §17 item 11: ALL tenants default to baa=true on day 1. Frank can toggle
// individual tenants off; the default is on-for-all — every vertical above
// carries baaDefault: true on purpose.

export const getVertical = (id) => OMZIG_VERTICALS.find((v) => v.id === id) ?? null
