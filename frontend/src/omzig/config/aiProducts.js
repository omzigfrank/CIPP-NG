/**
 * Omzig AI product line — Omzig Custom CIPP Build v1.1 §3 / §7.7.
 * Pricing floors are HARD: the quote engine refuses any quote below floor
 * without an executive override token signed by Frank. Enforcement lives
 * server-side (Modules/Omzig Test-OmzigQuoteFloor); this catalog drives the UI.
 */

export const OMZIG_AI_PRODUCTS = [
  {
    id: 'aira',
    label: 'AIRA — AI Readiness Assessment',
    purpose: 'Mandatory entry point, never discounted',
    smbFloor: 4000,
    recurring: false,
    marginFloor: 0.7,
  },
  {
    id: 'aidf',
    label: 'AIDF — AI Data Foundation',
    purpose: 'DLP, labels, Entra hardening',
    smbFloor: 11000,
    recurring: false,
    marginFloor: 0.7,
  },
  {
    id: 'aid',
    label: 'AID — AI Deployment',
    purpose: 'Copilot + Power Automate rollout',
    smbFloor: 15500,
    recurring: false,
    marginFloor: 0.7,
  },
  {
    id: 'maio',
    label: 'MAIO — Managed AI Operations',
    purpose: 'MRR engine, 12-month minimum',
    smbFloor: 3600,
    recurring: true,
    minimumTermMonths: 12,
    marginFloor: 0.7,
  },
]

/** Cost baselines for real-time margin computation (Omzig AI Pricing Model v4). */
export const OMZIG_COST_BASELINES = {
  techLaborHourly: 85, // 1099 contractor rate
  vcioHourly: 100, // Frank / vCIO internal cost rate — never billed as a client line item
}

/** AI engagement workflow states (§7.7 / §14). */
export const OMZIG_AI_STATUSES = ['not-started', 'proposed', 'in-progress', 'delivered']

export const getAiProduct = (id) => OMZIG_AI_PRODUCTS.find((p) => p.id === id) ?? null
