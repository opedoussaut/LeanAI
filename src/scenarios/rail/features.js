// DECIDE — the nine inputs of the rail decision model, computed deterministically from the evidence facts.
// Each value is normalised to roughly 0..1 so the small model sees comparable scales.
import { baseline, availableStock } from './recovery.js';

export const RAIL_FEATURES = [
  { id: 'delay_days', label: 'Disruption duration', unit: 'days / 20' },
  { id: 'criticality', label: 'Component criticality', unit: '1 = gates a station' },
  { id: 'inventory_coverage', label: 'Inventory coverage (exact variant)', unit: 'free units / units needed' },
  { id: 'products_affected', label: 'Products affected', unit: 'trainsets / 5' },
  { id: 'schedule_slack', label: 'Schedule slack (tightest)', unit: 'days / 10' },
  { id: 'supplier_alternatives', label: 'Supplier alternatives', unit: 'qualified options / 3' },
  { id: 'configuration_complexity', label: 'Configuration complexity', unit: 'variants in stock / 2' },
  { id: 'financial_exposure', label: 'Financial exposure', unit: '€ / 1,000,000' },
  { id: 'engineering_implication', label: 'Engineering implication', unit: '1 = a non-approved variant is within reach' }
];

/** Returns { vector, values } — values carry the human-readable figure behind each input. */
export function railFeatures(F) {
  const notKitted = F.pegged.filter(p => !p.kitted);
  const needed = notKitted.reduce((a, p) => a + (F.needed[p.id] ?? 0), 0);
  const exact = availableStock(F).filter(l => l.part === F.disruption.part).reduce((a, l) => a + l.qty, 0);
  const variants = new Set(F.lots.map(l => l.part));
  const configs = new Set(notKitted.map(p => p.config));
  const nonApprovedInReach = availableStock(F).some(l => [...configs].some(c => !F.rules.some(r => r.config === c && r.part === l.part && r.status === 'APPROVED')) && F.rules.some(r => r.part === l.part));
  const slack = notKitted.length ? Math.min(...notKitted.map(p => p.slack)) : 10;
  const exposure = baseline(F).total;
  const values = {
    delay_days: F.disruption.delayDays,
    criticality: needed > 0 ? 1 : 0.2,
    inventory_coverage: needed ? Math.min(1, exact / needed) : 1,
    products_affected: F.pegged.length,
    schedule_slack: slack,
    supplier_alternatives: F.options.filter(o => o.qualified).length,
    configuration_complexity: variants.size,
    financial_exposure: exposure,
    engineering_implication: nonApprovedInReach ? 1 : 0
  };
  const vector = [
    Math.min(1, values.delay_days / 20), values.criticality, values.inventory_coverage, Math.min(1, values.products_affected / 5),
    Math.min(1, values.schedule_slack / 10), Math.min(1, values.supplier_alternatives / 3), Math.min(1, values.configuration_complexity / 2),
    Math.min(1, values.financial_exposure / 1_000_000), values.engineering_implication
  ];
  return { vector, values };
}
