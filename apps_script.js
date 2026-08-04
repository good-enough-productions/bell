/**
 * ==============================================================================
 * Tabby Bell PWA - Google Apps Script Backend
 * ==============================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open a new or existing Google Sheet.
 * 2. Click on Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire file contents into Code.gs.
 * 4. Click 'Save' (Ctrl+S).
 * 5. Click 'Deploy' > 'New deployment'.
 * 6. Select type: 'Web app'.
 * 7. Set 'Execute as': 'Me' (your email).
 * 8. Set 'Who has access': 'Anyone' (this allows your PWA to send/receive requests without OAuth hassle).
 * 9. Click 'Deploy', authorize permissions if prompted, and COPY the 'Web App URL'.
 * 10. Paste the Web App URL into the Tabby PWA Settings tab!
 */

const SHEET_NAME = "Bell_History";

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add header row
    const headers = [["ID", "Timestamp", "Sender", "Message", "Status", "CompletedAt", "DurationSeconds"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length).setFontWeight("bold").setBackground("#e0e7ff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return responseJSON({ active: null, history: [] });
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    const history = rows.map(row => ({
      id: String(row[0]),
      timestamp: row[1] ? new Date(row[1]).toISOString() : "",
      sender: String(row[2] || ""),
      message: String(row[3] || ""),
      status: String(row[4] || "PENDING"),
      completedAt: row[5] ? new Date(row[5]).toISOString() : "",
      durationSeconds: row[6] ? Number(row[6]) : null
    }));

    // Find latest PENDING ring if any
    const active = history.slice().reverse().find(item => item.status === "PENDING") || null;

    return responseJSON({
      active: active,
      history: history.reverse() // Most recent first
    });
  } catch (err) {
    return responseJSON({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    if (payload.action === "ring") {
      const id = "ring_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      const timestamp = new Date().toISOString();
      const sender = payload.sender || "Partner";
      const message = payload.message || "Needs help in another room!";
      const status = "PENDING";
      const ntfyTopic = payload.ntfyTopic || "";

      // Append row
      sheet.appendRow([id, timestamp, sender, message, status, "", ""]);

      // Send ntfy.sh notification if topic configured
      if (ntfyTopic) {
        sendNtfyNotification(ntfyTopic, sender, message, id);
      }

      return responseJSON({
        success: true,
        ring: { id, timestamp, sender, message, status }
      });
    } 
    
    if (payload.action === "complete") {
      const id = payload.id;
      const data = sheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          const startTime = new Date(data[i][1]).getTime();
          const now = new Date();
          const completedAt = now.toISOString();
          const durationSeconds = Math.round((now.getTime() - startTime) / 1000);

          // Update Status (Col 5 = E), CompletedAt (Col 6 = F), Duration (Col 7 = G)
          sheet.getRange(i + 1, 5).setValue("COMPLETED");
          sheet.getRange(i + 1, 6).setValue(completedAt);
          sheet.getRange(i + 1, 7).setValue(durationSeconds);
          found = true;
          break;
        }
      }

      return responseJSON({ success: found });
    }

    return responseJSON({ error: "Unknown action" });
  } catch (err) {
    return responseJSON({ error: err.toString() });
  }
}

function sendNtfyNotification(topic, sender, message, ringId) {
  try {
    const url = "https://ntfy.sh/" + topic.trim();
    const payload = {
      topic: topic.trim(),
      title: "🔔 Urgent Bell Ring!",
      message: sender + ": " + message,
      priority: 5, // Urgent priority in ntfy
      tags: ["bell", "warning", "loudspeaker"],
      actions: [
        {
          action: "view",
          label: "Open Bell App",
          url: "https://ntfy.sh/" // placeholder or app URL
        }
      ]
    };

    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Ntfy dispatch error: " + e.toString());
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
