const numeric = (value, positive = false) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && (positive ? Number(value) > 0 : Number(value) >= 0);

export function constructionEstimate({ length, width, rows }) {
  const area = numeric(length, true) && numeric(width, true) ? Number(length) * Number(width) : null;
  const items = rows.map(row => ({ ...row,
    carbon: numeric(row.quantity, true) && numeric(row.factor) ? Number(row.quantity) * Number(row.factor) : null,
    sourceProvided: Boolean(row.source?.trim()),
    cost: numeric(row.quantity, true) && numeric(row.rate) ? Number(row.quantity) * Number(row.rate) : null,
  }));
  return { area, items,
    carbonSubtotal: items.reduce((sum, r) => sum + (r.carbon ?? 0), 0),
    costSubtotal: items.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    missingCarbon: items.filter(r => r.carbon === null).length,
    missingCost: items.filter(r => r.cost === null).length,
    carbon: items.length > 0 && items.every(r => r.carbon !== null) ? items.reduce((sum, r) => sum + r.carbon, 0) : null,
    cost: items.length > 0 && items.every(r => r.cost !== null) ? items.reduce((sum, r) => sum + r.cost, 0) : null,
  };
}
