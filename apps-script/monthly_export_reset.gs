// ─── Axivia Field App — Monthly Export & Reset ───────────────────────────────
//
// PURPOSE
//   On the 1st of every month (at ~1 AM IST), this script:
//     1. Exports every sheet in the spreadsheet to a dated CSV file and
//        saves it inside "Axivia Monthly Archives" in your Google Drive.
//     2. Clears all data rows (everything below the header row) in every sheet,
//        keeping the header intact so the app can continue writing immediately.
//
//   Net effect: the active spreadsheet stays tiny (header-only between resets)
//   while all historical data accumulates as lightweight CSV files in Drive.
//
// SETUP (do this once)
//   1. Open your field-app spreadsheet → Extensions → Apps Script
//   2. Create a new file (+ icon) → name it "monthly_export_reset"
//   3. Paste this entire file into it and save (Ctrl+S)
//   4. Run createMonthlyTrigger() ONCE by selecting it in the function
//      dropdown at the top and clicking ▶ Run
//   5. Authorise the permissions when prompted
//   Done — the trigger will fire automatically every month.
//
// MANUAL RUN (any time you want an immediate export + reset)
//   Select monthlyExportAndReset in the dropdown → click ▶ Run
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Config ────────────────────────────────────────────────────────────────────
// Name of the Drive folder where CSV archives will be saved.
const ARCHIVE_FOLDER_NAME = 'Axivia Monthly Archives';

// Sheets to skip entirely (they contain config / lookup data, not call logs).
// Add sheet names here if you want to exclude them from export + reset.
const SKIP_SHEETS = ['Config', 'Lookup', 'DNC'];

// ── Main function ─────────────────────────────────────────────────────────────
function monthlyExportAndReset() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const now       = new Date();
  const tz        = Session.getScriptTimeZone();

  // Label = previous month (since we run on the 1st of the NEW month)
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label     = Utilities.formatDate(prevMonth, tz, 'MMMM_yyyy');   // e.g. May_2026
  const displayLbl= Utilities.formatDate(prevMonth, tz, 'MMMM yyyy');   // e.g. May 2026

  // Locate or create the archive folder in Drive
  const folder = getOrCreateArchiveFolder_();

  const sheets      = ss.getSheets();
  const exported    = [];
  const skipped     = [];
  const noData      = [];

  sheets.forEach(sheet => {
    const name = sheet.getName();

    if (SKIP_SHEETS.includes(name)) { skipped.push(name); return; }

    const lastRow = sheet.getLastRow();

    // Sheet has only a header (or is empty) — nothing to export
    if (lastRow <= 1) { noData.push(name); return; }

    // ── Export to CSV ──────────────────────────────────────────────────────
    const range  = sheet.getDataRange();
    const values = range.getValues();

    const csvContent = values.map(row =>
      row.map(cell => {
        const str = (cell instanceof Date)
          ? Utilities.formatDate(cell, tz, 'yyyy-MM-dd HH:mm:ss')
          : String(cell == null ? '' : cell);
        // Wrap in quotes; escape any quotes inside
        return '"' + str.replace(/"/g, '""') + '"';
      }).join(',')
    ).join('\r\n');

    const filename = `Axivia_${name}_${label}.csv`;
    folder.createFile(filename, csvContent, MimeType.CSV);
    exported.push(name);

    // ── Reset: delete all data rows, keep header (row 1) ──────────────────
    // Using deleteRows so the cells are truly gone (frees quota).
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  });

  // ── Summary log ───────────────────────────────────────────────────────────
  const summary = [
    `[Axivia] Monthly export + reset complete — ${displayLbl}`,
    `Exported & reset : ${exported.join(', ') || 'none'}`,
    `Skipped (config) : ${skipped.join(', ')  || 'none'}`,
    `Already empty    : ${noData.join(', ')   || 'none'}`,
    `Archive folder   : ${folder.getUrl()}`,
  ].join('\n');

  Logger.log(summary);
  console.log(summary);   // visible in Apps Script Executions log
}

// ── Trigger setup ─────────────────────────────────────────────────────────────
// Run this function ONCE from the Apps Script editor to install the monthly trigger.
function createMonthlyTrigger() {
  // Remove any existing trigger for this function to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'monthlyExportAndReset')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Fire on the 1st of every month between 01:00–02:00 AM (script timezone)
  ScriptApp.newTrigger('monthlyExportAndReset')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();

  Logger.log('✓ Monthly trigger created — will fire on the 1st of every month at ~1 AM.');
}

// ── Helper: get or create the archive folder in Drive root ────────────────────
function getOrCreateArchiveFolder_() {
  const root    = DriveApp.getRootFolder();
  const folders = root.getFoldersByName(ARCHIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : root.createFolder(ARCHIVE_FOLDER_NAME);
}

// ── Utility: list active triggers (handy for verifying setup) ─────────────────
function listTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`Handler: ${t.getHandlerFunction()} | Type: ${t.getEventType()}`);
  });
}

// ── Utility: delete the monthly trigger if you ever want to disable it ─────────
function deleteMonthlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'monthlyExportAndReset')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Monthly trigger deleted.');
}
