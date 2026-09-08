// ============================================================================
// OrgPulse - Sheet Write-Back Web App
// ============================================================================
// This is NOT part of the React app's build - it runs inside Google's own
// infrastructure, bound to the "OrgChart Live Data" Sheet. Deploy steps:
//
//   1. Open the Google Sheet (the one OrgPulse reads from).
//   2. Extensions -> Apps Script. Delete any starter code in Code.gs, paste
//      this file's contents in instead.
//   3. Change EDIT_PIN below to whatever PIN you want HR editors to type
//      before a save/delete goes through. This PIN never ships in the
//      website's JS bundle - it only lives here, checked server-side.
//   4. Deploy -> New deployment -> gear icon -> "Web app".
//        Execute as: Me
//        Who has access: Anyone
//      Click Deploy, authorize when prompted, then copy the "Web app URL"
//      (ends in /exec). That URL goes into App.jsx as LIVE_SHEET_WRITE_URL.
//   5. Whenever you edit this script after the first deploy, you must create
//      a NEW deployment version (Deploy -> Manage deployments -> pencil icon
//      -> New version) for the change to actually take effect - saving the
//      script alone does not update a live deployment.
//
// This same /exec URL is now used for READS too (doGet below), not just writes -
// App.jsx's loadFromAppsScript tries it before ever falling back to the published-CSV
// link. Reason: File > Share > Publish to web regenerates its CSV snapshot on GOOGLE'S
// OWN schedule, independent of when a cell actually changes - a save here could be
// visible instantly in the Sheet itself while everyone's page, on refresh, still fetches
// the old pre-edit snapshot from that CSV link for several minutes or more. doGet has no
// such delay: it's a live SpreadsheetApp read executed fresh on every request.
// ============================================================================

const EDIT_PIN = '4321'; // CHANGE THIS before deploying

// Returns every row of the target sheet as JSON, read live (no caching layer of any
// kind sits between this and the actual cell values - unlike the published-CSV link,
// which lags real edits by however long Google takes to regenerate that snapshot).
// getDisplayValues() (not getValues()) so a date- or number-formatted cell comes
// through as the same plain string a human sees in the Sheet, matching exactly what
// the CSV export used to hand App.jsx's parseSheetRow - a raw Date/number value from
// getValues() would reach the app as something like a JS Date's toString() output
// instead of "2020-01-15", silently breaking anything that displays or sorts by it.
function doGet(e) {
  try {
    const sheet = getTargetSheet();
    if (!sheet) {
      return jsonResponse({ success: false, error: 'Could not find the target sheet tab' });
    }

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length === 0) {
      return jsonResponse({ success: true, members: [] });
    }

    const headers = data[0].map((h) => String(h).trim());
    const members = [];
    for (let r = 1; r < data.length; r++) {
      const member = {};
      headers.forEach((h, i) => { member[h] = data[r][i]; });
      members.push(member);
    }

    return jsonResponse({ success: true, members: members });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.pin !== EDIT_PIN) {
      return jsonResponse({ success: false, error: 'Incorrect PIN' });
    }

    const sheet = getTargetSheet();
    if (!sheet) {
      return jsonResponse({ success: false, error: 'Could not find the target sheet tab' });
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map((h) => String(h).trim());
    const idCol = headers.indexOf('id');
    const managerIdCol = headers.indexOf('managerId');

    if (idCol === -1) {
      return jsonResponse({ success: false, error: 'Sheet has no "id" column in row 1' });
    }

    if (payload.action === 'save') {
      return handleSave(sheet, data, headers, idCol, payload.member || {});
    }

    if (payload.action === 'delete') {
      return handleDelete(sheet, data, headers, idCol, managerIdCol, payload.id, payload.reassignManagerId);
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + payload.action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function handleSave(sheet, data, headers, idCol, member) {
  const memberId = String(member.id != null ? member.id : '').trim();
  if (!memberId) {
    return jsonResponse({ success: false, error: 'Member is missing an id' });
  }

  // Build the row in the sheet's own column order, by header NAME - so this
  // still works correctly no matter what order the columns are in, and
  // ignores any payload field that doesn't have a matching header.
  const rowValues = headers.map((h) => {
    let v = member[h];
    if (h === 'skills' && Array.isArray(v)) v = v.join('|');
    if (v === null || v === undefined) return '';
    return v;
  });

  let targetRow = -1;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idCol]).trim() === memberId) {
      targetRow = r + 1; // 1-indexed sheet row
      break;
    }
  }

  if (targetRow === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
  }

  return jsonResponse({ success: true });
}

function handleDelete(sheet, data, headers, idCol, managerIdCol, id, reassignManagerId) {
  const targetId = String(id != null ? id : '').trim();
  if (!targetId) {
    return jsonResponse({ success: false, error: 'Missing id to delete' });
  }
  const reassignTo = reassignManagerId ? String(reassignManagerId).trim() : '';

  // Reassign anyone reporting to the deleted employee BEFORE removing the
  // row, using the pre-mutation `data` snapshot to decide which rows match -
  // matches the app's own local behavior (see handleDeleteMember in App.jsx).
  if (managerIdCol !== -1) {
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][managerIdCol]).trim() === targetId) {
        sheet.getRange(r + 1, managerIdCol + 1).setValue(reassignTo);
      }
    }
  }

  let targetRow = -1;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idCol]).trim() === targetId) {
      targetRow = r + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return jsonResponse({ success: false, error: 'Employee not found (already deleted?)' });
  }

  sheet.deleteRow(targetRow);
  return jsonResponse({ success: true });
}

// The published CSV URL uses gid=0, which is the sheet ID (getSheetId) of
// whichever tab was first in the spreadsheet - not necessarily one named
// "Sheet1". Matching on that instead of a hardcoded tab name keeps this in
// sync with whatever OrgPulse is actually reading, even if the tab gets
// renamed later.
function getTargetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const byGid = ss.getSheets().find((s) => s.getSheetId() === 0);
  return byGid || ss.getSheets()[0];
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
