/**
 * Site Comparison Service (Feature-based Architecture)
 * Computes comparative spatial accessibility, density metrics, category deltas,
 * and data-driven recommendations between two urban sites.
 */

import { calculateAmenitiesDensityScore } from '../density/densityService.js';

export function calculateSiteComparison({
  siteA,
  siteB,
  statsA,
  statsB,
  densityA,
  densityB,
  mode = 'walking',
  minutes = 20,
}) {
  const scoreDiff = (densityB?.score ?? 0) - (densityA?.score ?? 0);
  const placesDiff = (statsB?.total ?? 0) - (statsA?.total ?? 0);
  const densityDiff = Number(((densityB?.densityPerKm2 ?? 0) - (densityA?.densityPerKm2 ?? 0)).toFixed(1));

  // Determine leader
  let winner = 'tie';
  let winnerText = 'Both locations demonstrate comparable spatial accessibility.';
  if (scoreDiff > 3) {
    winner = 'siteB';
    winnerText = `${siteB.name} leads with +${scoreDiff} pts higher 15-min city accessibility score.`;
  } else if (scoreDiff < -3) {
    winner = 'siteA';
    winnerText = `${siteA.name} leads with +${Math.abs(scoreDiff)} pts higher 15-min city accessibility score.`;
  }

  // Category comparisons
  const categoriesList = [
    { id: 'food', label: 'Food & Dining', shape: 'circle', color: '#ea580c' },
    { id: 'transport', label: 'Public Transit', shape: 'triangle', color: '#2563eb' },
    { id: 'shopping', label: 'Shopping & Retail', shape: 'square', color: '#0284c7' },
    { id: 'education', label: 'Schools & Education', shape: 'hexagon', color: '#16a34a' },
    { id: 'services', label: 'Daily Services', shape: 'diamond', color: '#0d9488' },
    { id: 'things-to-do', label: 'Leisure & Parks', shape: 'star', color: '#9333ea' },
  ];

  const breakdownA = statsA?.typeBreakdown || [];
  const breakdownB = statsB?.typeBreakdown || [];

  function getGroupCount(places = [], groupId) {
    return places.filter((p) => {
      const g = p.cat?.groupId || p.cat?.groupName;
      if (g) return g.toLowerCase().includes(groupId) || (groupId === 'food' && g.includes('food'));
      return false;
    }).length;
  }

  const categoryComparisons = categoriesList.map((cat) => {
    // Count places in group
    const countA = (statsA?.places || []).filter((p) => p.cat?.groupId === cat.id).length;
    const countB = (statsB?.places || []).filter((p) => p.cat?.groupId === cat.id).length;
    const diff = countB - countA;

    return {
      id: cat.id,
      label: cat.label,
      shape: cat.shape,
      color: cat.color,
      countA,
      countB,
      diff,
      advantage: diff > 0 ? 'siteB' : diff < 0 ? 'siteA' : 'equal',
    };
  });

  // Generate automated executive takeaways
  const takeaways = [];

  const transitCat = categoryComparisons.find((c) => c.id === 'transport');
  if (transitCat && transitCat.diff !== 0) {
    const leader = transitCat.diff > 0 ? siteB.name : siteA.name;
    const delta = Math.abs(transitCat.diff);
    takeaways.push(`Transit Connectivity: ${leader} has ${delta} more transit station(s) within ${minutes}-min reach.`);
  }

  const foodCat = categoryComparisons.find((c) => c.id === 'food');
  if (foodCat && Math.abs(foodCat.diff) >= 5) {
    const leader = foodCat.diff > 0 ? siteB.name : siteA.name;
    takeaways.push(`Dining & Cafes: ${leader} offers higher culinary vitality (+${Math.abs(foodCat.diff)} dining options).`);
  }

  const eduCat = categoryComparisons.find((c) => c.id === 'education');
  if (eduCat && eduCat.diff !== 0) {
    const leader = eduCat.diff > 0 ? siteB.name : siteA.name;
    takeaways.push(`Education Access: ${leader} provides greater school/learning institution density.`);
  }

  if (takeaways.length === 0) {
    takeaways.push(`Both sites feature balanced amenity distributions under current ${minutes}-minute ${mode} parameters.`);
  }

  return {
    siteA,
    siteB,
    statsA,
    statsB,
    densityA,
    densityB,
    winner,
    winnerText,
    scoreDiff,
    placesDiff,
    densityDiff,
    categoryComparisons,
    takeaways,
    mode,
    minutes,
  };
}
