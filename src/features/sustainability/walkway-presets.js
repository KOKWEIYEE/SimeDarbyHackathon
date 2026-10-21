export const concreteSource = {
  url: 'https://ukcsma.co.uk/sustainability/',
  publisher: 'Cementitious Slag Makers Association',
  retrieved: '2026-10-21',
  region: 'UK reference; not a Malaysian product EPD',
  boundary: 'Published embodied CO2e concrete comparison; module boundaries and publication date not specified on page. Not a whole-project lifecycle assessment.',
  grade: 'RC32/40',
  unit: 'kgCO2e/m3',
  baseline: 336,
  alternative: 196,
};

export function presetPlans(length, width, thickness, covered = false) {
  if (![length, width, thickness].every(v => v !== '' && Number.isFinite(Number(v)) && Number(v) > 0)) return null;
  const volume = Number(length) * Number(width) * Number(thickness);
  return [false, true].map(alternative => [
    { name: alternative ? 'RC32/40 concrete - 50% GGBS reference' : 'RC32/40 concrete - Portland cement reference',
      unit: 'm3', quantity: volume, factor: alternative ? concreteSource.alternative : concreteSource.baseline,
      rate: '', source: `${concreteSource.publisher}; ${concreteSource.url}; retrieved ${concreteSource.retrieved}; ${concreteSource.boundary}`,
      preset: 'concrete-surface', provenance: concreteSource },
    { name: 'Sub-base (specification needed)', quantity: '', factor: '', rate: '', source: '' },
    ...(covered ? ['Roof', 'Supports and foundations'].map(name => ({ name, cover: true, quantity: '', factor: '', rate: '', source: '' })) : []),
  ]);
}
