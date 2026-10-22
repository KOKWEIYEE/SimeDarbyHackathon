import React from 'react';

/**
 * Parses markdown inline bold and emoji formatting.
 */
function renderInlineFormatted(text) {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="rich-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/**
 * RichChatMessage component
 * Renders Markdown tables, structured amenities lists, and overall insight cards cleanly in the AI chat.
 */
export default function RichChatMessage({ text, sender = 'bot' }) {
  if (!text || sender === 'user') {
    return <div className="chat-bubble-text">{text}</div>;
  }

  // Split lines
  const lines = text.split(/\r?\n/);
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 1. Detect Markdown Table
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].slice(1, -1).split('|').map((s) => s.trim());
        // Skip separator line if present (e.g. |---|---|)
        const startIndex = tableLines[1].includes('---') ? 2 : 1;
        const bodyRows = tableLines.slice(startIndex).map((rowStr) =>
          rowStr.slice(1, -1).split('|').map((s) => s.trim())
        );

        elements.push(
          <div key={`table-${i}`} className="rich-table-wrap">
            <table className="rich-chat-table">
              <thead>
                <tr>
                  {headerRow.map((h, hIdx) => (
                    <th key={hIdx}>{renderInlineFormatted(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => {
                      const isDelta = cIdx === row.length - 1;
                      const hasAdvantage = cell.includes('+') || cell.toLowerCase().includes('site') || cell.toLowerCase().includes('lead') || cell.toLowerCase().includes('winner');
                      return (
                        <td key={cIdx} className={isDelta ? 'cell-delta' : ''}>
                          {isDelta && hasAdvantage ? (
                            <span className="rich-delta-badge">{renderInlineFormatted(cell)}</span>
                          ) : (
                            renderInlineFormatted(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Detect Overall Insight Section
    if (/^#{1,4}\s*(?:💡|★)?\s*Overall Insight/i.test(line) || /^\*\*(?:💡|★)?\s*Overall Insight/i.test(line)) {
      const insightLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('##')) {
        if (lines[i].trim()) insightLines.push(lines[i].trim());
        i++;
      }

      elements.push(
        <div key={`insight-${i}`} className="rich-insight-card">
          <div className="rich-insight-header">
            <span className="rich-insight-icon">💡</span>
            <span className="rich-insight-title">Overall Insight</span>
          </div>
          <div className="rich-insight-content">
            {insightLines.map((inLine, inIdx) => (
              <div key={inIdx} className="rich-insight-item">
                {renderInlineFormatted(inLine.replace(/^[•*-]\s*/, ''))}
              </div>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 3. Detect Amenities List Header
    if (/^#{1,4}\s*(?:📍|🏬)?\s*Amenities/i.test(line)) {
      const title = line.replace(/^#+\s*/, '');
      const listItems = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('##') && !lines[i].trim().startsWith('|')) {
        const itemLine = lines[i].trim();
        if (itemLine) listItems.push(itemLine);
        i++;
      }

      elements.push(
        <div key={`amenities-${i}`} className="rich-amenities-card">
          <div className="rich-amenities-header">
            <span className="rich-amenities-icon">🏬</span>
            <span className="rich-amenities-title">{renderInlineFormatted(title)}</span>
          </div>
          <ul className="rich-amenities-list">
            {listItems.map((li, liIdx) => {
              const cleanLi = li.replace(/^[•*-]\s*/, '');
              return (
                <li key={liIdx} className="rich-amenity-item">
                  <span className="amenity-bullet">•</span>
                  <span className="amenity-text">{renderInlineFormatted(cleanLi)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
      continue;
    }

    // 4. Regular Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="rich-chat-h3">
          {renderInlineFormatted(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="rich-chat-h2">
          {renderInlineFormatted(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }

    // 5. Bullet item
    if (/^[•*-]\s+/.test(line)) {
      elements.push(
        <div key={`bullet-${i}`} className="rich-chat-bullet">
          <span className="bullet-dot">•</span>
          <span className="bullet-content">{renderInlineFormatted(line.replace(/^[•*-]\s+/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // 6. Normal paragraph text
    elements.push(
      <p key={`p-${i}`} className="rich-chat-p">
        {renderInlineFormatted(line)}
      </p>
    );
    i++;
  }

  return <div className="rich-chat-message-container">{elements}</div>;
}
