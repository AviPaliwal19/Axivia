/**
 * =====================================================
 *  AXIVIA AUTO-EXPORT — Google Apps Script
 * =====================================================
 *
 * This script reads data from your Axivia Google Sheet
 * and emails formatted reports automatically.
 *
 * SETUP:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire file, replacing any default code.
 * 3. Update REPORT_EMAIL and SHEET_ID below.
 * 4. Run weeklyExport() once manually to grant permissions.
 * 5. Set up triggers:
 *    - Click the clock icon (Triggers) in the left sidebar
 *    - "+ Add Trigger"
 *    - Weekly: function=weeklyExport, time-driven, week timer, Monday 8-9am
 *    - Daily:  function=dailyExport, time-driven, day timer, 8-9am
 */

const REPORT_EMAIL = 'your@email.com';
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // from the Sheet URL between /d/ and /edit

// ─── Tier helpers ──────────────────────────────────────

function getTier(score) {
  const s = Number(score) || 0;
  if (s >= 8) return { label: 'HOT', color: '#22c55e' };
  if (s >= 5) return { label: 'WARM', color: '#C9A84C' };
  if (s >= 3) return { label: 'COLD', color: '#fb923c' };
  return { label: 'TRACE', color: '#ef4444' };
}

function getSheetData(tabName) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  } catch (e) {
    Logger.log('Error reading tab ' + tabName + ': ' + e);
    return [];
  }
}

// ─── Counting ──────────────────────────────────────────

function countTiers(rows) {
  const counts = { HOT: 0, WARM: 0, COLD: 0, TRACE: 0, total: 0 };
  rows.forEach(r => {
    const tier = getTier(r.score || r.totalscore || 0);
    counts[tier.label]++;
    counts.total++;
  });
  return counts;
}

// ─── HTML builders ─────────────────────────────────────

function styleBlock() {
  return '<style>'
    + 'body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}'
    + '.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}'
    + 'h1{color:#0A0A0F;margin:0 0 4px}h2{color:#333;margin:16px 0 8px}'
    + '.stat{display:inline-block;text-align:center;padding:12px 20px;margin:4px;border-radius:8px;color:#fff;font-weight:bold}'
    + '.hot{background:#22c55e}.warm{background:#C9A84C}.cold{background:#fb923c}.trace{background:#ef4444}'
    + 'table{width:100%;border-collapse:collapse;font-size:13px}'
    + 'th{background:#0A0A0F;color:#fff;padding:8px;text-align:left}'
    + 'td{padding:8px;border-bottom:1px solid #eee}'
    + 'tr:nth-child(even){background:#f9f9f9}'
    + '.tier-badge{display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:11px;font-weight:bold}'
    + '</style>';
}

function tierBadge(score) {
  const t = getTier(score);
  return '<span class="tier-badge" style="background:' + t.color + '">' + t.label + '</span>';
}

function buildStatsHtml(sellerCounts, buyerCounts) {
  const total = sellerCounts.total + buyerCounts.total;
  let html = '<div class="card">';
  html += '<h2>Overview</h2>';
  html += '<div class="stat" style="background:#333">Total: ' + total + '</div>';
  html += '<div class="stat" style="background:#4C8EC9">Sellers: ' + sellerCounts.total + '</div>';
  html += '<div class="stat" style="background:#9B4CC9">Buyers: ' + buyerCounts.total + '</div>';
  html += '</div>';

  html += '<div class="card"><h2>Sellers by Tier</h2>';
  html += '<div class="stat hot">HOT ' + sellerCounts.HOT + '</div>';
  html += '<div class="stat warm">WARM ' + sellerCounts.WARM + '</div>';
  html += '<div class="stat cold">COLD ' + sellerCounts.COLD + '</div>';
  html += '<div class="stat trace">TRACE ' + sellerCounts.TRACE + '</div>';
  html += '</div>';

  html += '<div class="card"><h2>Buyers by Tier</h2>';
  html += '<div class="stat hot">HOT ' + buyerCounts.HOT + '</div>';
  html += '<div class="stat warm">WARM ' + buyerCounts.WARM + '</div>';
  html += '<div class="stat cold">COLD ' + buyerCounts.COLD + '</div>';
  html += '<div class="stat trace">TRACE ' + buyerCounts.TRACE + '</div>';
  html += '</div>';

  return html;
}

function buildLeadsTable(rows, label) {
  const hotWarm = rows.filter(r => {
    const s = Number(r.score || r.totalscore || 0);
    return s >= 5;
  });
  if (hotWarm.length === 0) return '<div class="card"><h2>' + label + ' — HOT & WARM Leads</h2><p>No hot/warm leads.</p></div>';

  let html = '<div class="card"><h2>' + label + ' — HOT & WARM Leads (' + hotWarm.length + ')</h2>';
  html += '<table><tr><th>Name</th><th>Phone</th><th>Locality</th><th>Score</th><th>Tier</th><th>Next Action</th><th>Date</th></tr>';
  hotWarm.forEach(r => {
    const score = Number(r.score || r.totalscore || 0);
    html += '<tr>';
    html += '<td>' + (r.fullname || r.name || '-') + '</td>';
    html += '<td>' + (r.phone || '-') + '</td>';
    html += '<td>' + (r.locality || '-') + '</td>';
    html += '<td>' + score + '/10</td>';
    html += '<td>' + tierBadge(score) + '</td>';
    html += '<td>' + (r.nextaction || '-') + '</td>';
    html += '<td>' + (r.date || r.timestamp || '-') + '</td>';
    html += '</tr>';
  });
  html += '</table></div>';
  return html;
}

// ─── Weekly export ─────────────────────────────────────

function weeklyExport() {
  const sellers = getSheetData('Sellers');
  const buyers = getSheetData('Buyers');
  const sellerCounts = countTiers(sellers);
  const buyerCounts = countTiers(buyers);

  let html = '<html><head>' + styleBlock() + '</head><body>';
  html += '<h1>Axivia Weekly Report</h1>';
  html += '<p style="color:#666">Generated: ' + new Date().toLocaleString() + '</p>';
  html += buildStatsHtml(sellerCounts, buyerCounts);
  html += buildLeadsTable(sellers, 'Sellers');
  html += buildLeadsTable(buyers, 'Buyers');
  html += '</body></html>';

  MailApp.sendEmail({
    to: REPORT_EMAIL,
    subject: 'Axivia Weekly Report — ' + new Date().toLocaleDateString(),
    htmlBody: html
  });

  Logger.log('Weekly report sent to ' + REPORT_EMAIL);
}

// ─── Daily export ──────────────────────────────────────

function dailyExport() {
  const sellers = getSheetData('Sellers');
  const buyers = getSheetData('Buyers');
  const sellerCounts = countTiers(sellers);
  const buyerCounts = countTiers(buyers);

  // Filter HOT leads from last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentHot = function(rows) {
    return rows.filter(r => {
      const s = Number(r.score || r.totalscore || 0);
      if (s < 8) return false;
      try {
        const d = new Date(r.date || r.timestamp);
        return d >= cutoff;
      } catch (e) { return false; }
    });
  };

  const hotSellers = recentHot(sellers);
  const hotBuyers = recentHot(buyers);
  const newHotCount = hotSellers.length + hotBuyers.length;

  let html = '<html><head>' + styleBlock() + '</head><body>';
  html += '<h1>Axivia Daily Summary</h1>';
  html += '<p style="color:#666">Generated: ' + new Date().toLocaleString() + '</p>';

  html += '<div class="card">';
  html += '<h2>Totals</h2>';
  html += '<p><strong>Sellers:</strong> ' + sellerCounts.total + ' (HOT: ' + sellerCounts.HOT + ', WARM: ' + sellerCounts.WARM + ', COLD: ' + sellerCounts.COLD + ', TRACE: ' + sellerCounts.TRACE + ')</p>';
  html += '<p><strong>Buyers:</strong> ' + buyerCounts.total + ' (HOT: ' + buyerCounts.HOT + ', WARM: ' + buyerCounts.WARM + ', COLD: ' + buyerCounts.COLD + ', TRACE: ' + buyerCounts.TRACE + ')</p>';
  html += '</div>';

  if (newHotCount > 0) {
    html += '<div class="card"><h2>New HOT Leads (Last 24h): ' + newHotCount + '</h2>';
    html += '<table><tr><th>Mode</th><th>Name</th><th>Phone</th><th>Locality</th><th>Score</th><th>Next Action</th></tr>';
    hotSellers.forEach(r => {
      html += '<tr><td>SELLER</td><td>' + (r.fullname || r.name || '-') + '</td><td>' + (r.phone || '-') + '</td><td>' + (r.locality || '-') + '</td><td>' + (r.score || r.totalscore || 0) + '/10</td><td>' + (r.nextaction || '-') + '</td></tr>';
    });
    hotBuyers.forEach(r => {
      html += '<tr><td>BUYER</td><td>' + (r.fullname || r.name || '-') + '</td><td>' + (r.phone || '-') + '</td><td>' + (r.locality || '-') + '</td><td>' + (r.score || r.totalscore || 0) + '/10</td><td>' + (r.nextaction || '-') + '</td></tr>';
    });
    html += '</table></div>';
  } else {
    html += '<div class="card"><p>No new HOT leads in the last 24 hours.</p></div>';
  }

  html += '</body></html>';

  MailApp.sendEmail({
    to: REPORT_EMAIL,
    subject: 'Axivia Daily Summary — ' + new Date().toLocaleDateString(),
    htmlBody: html
  });

  Logger.log('Daily report sent to ' + REPORT_EMAIL);
}