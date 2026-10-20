/**
 * Clean & Professional PDF Analysis Report Generator
 * Generates an executive GIS report containing:
 * 1. Attached Isochrone Map
 * 2. Trustworthy Amenities Density Score & Executive Summary
 * 3. Count of each amenities (summary table by category & subcategory)
 * 4. Detailed amenities results (paginated table of places)
 */

export async function generatePdfAnalysisReport({
  mapCanvas,
  analysisResult,
  densityScore,
  locationName = 'Sime Darby Centre',
  locationAddress = '',
  travelMode = 'walking',
  travelMinutes = 20,
}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    throw new Error('jsPDF library is not loaded.');
  }

  // Portrait A4: 595.28 x 841.89 pt
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const modeLabels = {
    walking: 'Pedestrian Walk',
    cycling: 'Bicycle Ride',
    driving: 'Vehicle Drive',
  };

  const currentDate = new Date().toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // ── Helper: Draw Header Bar ─────────────────────────────────────────────
  function drawHeader(title = 'Accessibility & Amenities Analysis Report') {
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 52, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('SIME DARBY PROPERTY  |  GIS ANALYTICS', margin, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text(title, margin, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(currentDate, pageWidth - margin, 32, { align: 'right' });
  }

  // ── Helper: Draw Footer with Page Number ────────────────────────────────
  function drawFooter(pageNum, totalPages) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Sime Darby Property GIS Platform  •  Isochrone Spatial Analysis', margin, pageHeight - 16);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: ISOCHRONE MAP & EXECUTIVE DENSITY SCORE
  // ══════════════════════════════════════════════════════════════════════════
  drawHeader('Executive Location Accessibility Report');

  let y = 68;

  // Title Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(`Location Analysis: ${locationName}`, margin, y);
  y += 15;

  if (locationAddress) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 99, 235);
    doc.text(`Exact Address: `, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${locationAddress}`, margin + 68, y);
    y += 13;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Catchment: ${travelMinutes} min ${modeLabels[travelMode] || travelMode} Isochrone  •  Generated on ${currentDate}`,
    margin,
    y
  );
  y += 14;

  // 1. ATTACH ISOCHRONE MAP
  if (mapCanvas) {
    try {
      const mapImg = mapCanvas.toDataURL('image/png');
      const mapHeight = 230;

      // Card border & background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, contentWidth, mapHeight, 6, 6, 'FD');

      // Insert map snapshot
      doc.addImage(mapImg, 'PNG', margin + 2, y + 2, contentWidth - 4, mapHeight - 20);

      // Map Caption
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Figure 1: Isochrone Catchment Boundary (${travelMinutes} min ${modeLabels[travelMode] || travelMode}) & Amenity Distribution`,
        margin + 10,
        y + mapHeight - 6
      );

      y += mapHeight + 14;
    } catch (err) {
      console.warn('Map canvas capture failed for PDF:', err);
    }
  }

  // 2. TRUSTWORTHY AMENITIES DENSITY SCORE & METRICS CARDS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Trustworthy Amenities Density & Spatial Metrics', margin, y);
  y += 12;

  // 4 Metric Summary Cards in Grid
  const cardW = (contentWidth - 18) / 4;
  const cardH = 54;
  const cards = [
    {
      label: 'Density Score',
      val: `${densityScore?.densityPerKm2 ?? 0}`,
      sub: 'places / km²',
      color: [37, 99, 235],
    },
    {
      label: 'Isochrone Area',
      val: `${densityScore?.areaKm2 ?? 0}`,
      sub: 'square kilometers (km²)',
      color: [13, 148, 136],
    },
    {
      label: '15-Min City Rating',
      val: `${densityScore?.score ?? 0} / 100`,
      sub: densityScore?.rating ? densityScore.rating.split('(')[0].trim() : 'Active Urban Zone',
      color: [22, 163, 74],
    },
    {
      label: 'Total Amenities',
      val: `${analysisResult?.total ?? densityScore?.totalPlaces ?? 0}`,
      sub: `Across ${analysisResult?.typeBreakdown?.length || 0} subcategories`,
      color: [147, 51, 234],
    },
  ];

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + 6);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.8);
    doc.roundedRect(cx, y, cardW, cardH, 5, 5, 'FD');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 8, y + 14);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, cx + 8, y + 31);

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(c.sub, cardW - 14), cx + 8, y + 43);
  });

  y += cardH + 16;

  // Executive Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const summaryText =
    `Spatial Density Evaluation: Based on the ${travelMinutes}-minute ${travelMode} isochrone catchment area of ` +
    `${densityScore?.areaKm2 ?? 'N/A'} km², there are a total of ${analysisResult?.total ?? 0} accessible amenities ` +
    `yielding a spatial density of ${densityScore?.densityPerKm2 ?? 'N/A'} amenities per square kilometer. ` +
    `The urban diversity index is evaluated at ${densityScore?.diversityIndex ?? 'N/A'} (Evenness: ${densityScore?.evenness ?? 'N/A'}), ` +
    `qualifying this area under the 15-Minute City standard as "${densityScore?.rating || 'Established Urban District'}".`;
  doc.text(doc.splitTextToSize(summaryText, contentWidth), margin, y);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: COUNT OF EACH AMENITIES (SUMMARY BREAKDOWN)
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader('Amenities Count & Subcategory Breakdown');

  y = 70;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Count of Each Amenity Category & Subcategory', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Comprehensive quantification of verified amenities within the ${travelMinutes}-minute isochrone boundary.`,
    margin,
    y
  );
  y += 16;

  // Table Header
  const colW = [18, 140, 150, 75, 75, 65]; // total: 523
  const thY = y;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, thY, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('#', margin + 6, thY + 14);
  doc.text('Subcategory Name', margin + 26, thY + 14);
  doc.text('Category Group', margin + 170, thY + 14);
  doc.text('Count', margin + 325, thY + 14, { align: 'right' });
  doc.text('Share (%)', margin + 405, thY + 14, { align: 'right' });
  doc.text('Density (/km²)', margin + 495, thY + 14, { align: 'right' });

  y += 22;

  const breakdown = analysisResult?.typeBreakdown || [];
  const total = analysisResult?.total || 1;
  const area = densityScore?.areaKm2 || 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  breakdown.forEach((item, i) => {
    const isEven = i % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 18, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 18, margin + contentWidth, y + 18);

    doc.setTextColor(71, 85, 105);
    doc.text(`${i + 1}`, margin + 6, y + 12);

    // Subcategory with dot
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.label || item.id, margin + 26, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.groupName || item.groupId || 'Amenity', margin + 170, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.count}`, margin + 325, y + 12, { align: 'right' });

    const pct = ((item.count / total) * 100).toFixed(1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${pct}%`, margin + 405, y + 12, { align: 'right' });

    const perKm = (item.count / area).toFixed(1);
    doc.text(`${perKm}`, margin + 495, y + 12, { align: 'right' });

    y += 18;

    if (y > pageHeight - 50) {
      doc.addPage();
      drawHeader('Amenities Count Breakdown (Continued)');
      y = 70;
    }
  });

  // Table Total Row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Total Verified Amenities', margin + 26, y + 13);
  doc.text(`${analysisResult?.total ?? 0}`, margin + 325, y + 13, { align: 'right' });
  doc.text('100.0%', margin + 405, y + 13, { align: 'right' });
  doc.text(`${densityScore?.densityPerKm2 ?? 0}`, margin + 495, y + 13, { align: 'right' });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3+: DETAILED AMENITIES RESULTS (INDIVIDUAL PLACES DIRECTORY)
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader('Detailed Amenities Directory');

  y = 70;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Detailed Amenities Results', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Individual listing of all places identified within the travel-time catchment area.',
    margin,
    y
  );
  y += 16;

  // Table Header
  const thY2 = y;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, thY2, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('#', margin + 6, thY2 + 14);
  doc.text('Place Name', margin + 26, thY2 + 14);
  doc.text('Category', margin + 210, thY2 + 14);
  doc.text('Address / Location', margin + 330, thY2 + 14);
  doc.text('Band', margin + 495, thY2 + 14, { align: 'right' });

  y += 22;

  const placesList = analysisResult?.places || [];

  placesList.forEach((place, idx) => {
    if (y > pageHeight - 45) {
      doc.addPage();
      drawHeader('Detailed Amenities Directory (Continued)');
      y = 70;

      // Repeat Header on new page
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('#', margin + 6, y + 13);
      doc.text('Place Name', margin + 26, y + 13);
      doc.text('Category', margin + 210, y + 13);
      doc.text('Address / Location', margin + 330, y + 13);
      doc.text('Band', margin + 495, y + 13, { align: 'right' });
      y += 20;
    }

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 18, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 18, margin + contentWidth, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${idx + 1}`, margin + 6, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const truncatedName = doc.splitTextToSize(place.name || 'Unnamed', 175)[0];
    doc.text(truncatedName, margin + 26, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const catText = place.cat?.label || place.categoryId || 'Place';
    doc.text(doc.splitTextToSize(catText, 110)[0], margin + 210, y + 12);

    doc.setTextColor(71, 85, 105);
    const addrText = place.address || (place.lat ? `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}` : 'In catchment');
    doc.text(doc.splitTextToSize(addrText, 155)[0], margin + 330, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`≤${place.band || travelMinutes}m`, margin + 495, y + 12, { align: 'right' });

    y += 18;
  });

  // Stamp page footers across all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  // Save PDF
  const filename = `sime-darby-amenities-analysis-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`;
  doc.save(filename);
  return filename;
}
