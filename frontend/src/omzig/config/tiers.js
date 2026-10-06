/**
 * Omzig service tier catalog — Omzig Custom CIPP Build v1.1 §3.
 * Tenants and users carry a tier tag (§7.11); tier-based standards key off `id`.
 */

export const OMZIG_TIERS = [
  {
    id: 'core',
    label: 'Omzig Core',
    priceMin: 119,
    priceMax: 175,
    m365Sku: 'Business Premium',
  },
  {
    id: 'edge',
    label: 'Omzig Edge',
    priceMin: 139,
    priceMax: 245,
    m365Sku: 'Business Premium + Defender for Office P2',
  },
  {
    id: 'summit',
    label: 'Omzig Summit',
    priceMin: 169,
    priceMax: 169,
    m365Sku: 'Business Premium + Compliance, Executive dashboards',
  },
  {
    id: 'pinnacle',
    label: 'Omzig Pinnacle',
    priceMin: 249,
    priceMax: 249,
    m365Sku: 'Business Premium + Windows 365 Cloud PC',
  },
  { id: 'core-plus', label: 'Omzig Core+', priceMin: 280, priceMax: 280, m365Sku: 'E5' },
  { id: 'edge-plus', label: 'Omzig Edge+', priceMin: 350, priceMax: 350, m365Sku: 'E5' },
  { id: 'premium-plus', label: 'Omzig Premium+', priceMin: 430, priceMax: 430, m365Sku: 'E5' },
]

export const getTier = (id) => OMZIG_TIERS.find((t) => t.id === id) ?? null
