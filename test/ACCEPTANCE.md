# ON-DEVICE ACCEPTANCE — Device: __________ | Build **0.1.7** (versionCode **8**) | Date: __________ | **PASS** / **FAIL**

Install package `il.co.karisi.ran` on a physical Android device (Hebrew UI, RTL). Check each item; record failures with steps and screenshots.

---

## 1. Four pages, RTL tabs, FAB

- [ ] Tabs are RTL: rightmost **רן**, then **כללי**, then **עבודה**, leftmost **זבל**. **Expected:** All four visible; **עבודה** is selected on cold start.
- [ ] Swipe horizontally on the board (finger follows RTL “next page” direction). **Expected:** Pages change in order רן ↔ כללי ↔ עבודה ↔ זבל; tab highlight follows.
- [ ] Open **זבל**. **Expected:** Floating **+** (FAB) is not shown.
- [ ] On **רן**, **כללי**, or **עבודה**, FAB **+** is visible. **Expected:** Tapping FAB opens new-task sheet (see §2).

---

## 2. Create, edit, autosave, discard empty

- [ ] Tap FAB **+** on **עבודה** (or any non-זבל page). **Expected:** Edit sheet opens for a new task on that page.
- [ ] Tap an existing task card. **Expected:** Same edit sheet opens with saved content.
- [ ] Type a task name; wait ~1–2 s without tapping Save; swipe down to close sheet. Reopen the card. **Expected:** Name is persisted (autosave).
- [ ] Change an existing field, close sheet (swipe down). **Expected:** Toast **נשמר** appears after a real edit is closed.
- [ ] FAB **+** → leave name, phone, address, notes, and photos all empty → close sheet on purpose. **Expected:** Task is discarded (no empty card on the board).

---

## 3. Long-press drag between pages and reorder

- [ ] Long-press a card ~0.4 s, drag sideways (RTL: toward **left** for “next” page). **Expected:** Hint chip shows destination page name.
- [ ] Release on another page. **Expected:** Task moves; card appears on target page.
- [ ] Long-press and drag vertically within one page. **Expected:** Card reorders among siblings on that page.

---

## 4. Swipes (supported vs not)

- [ ] Swipe between board pages. **Expected:** Page changes (see §1).
- [ ] On edit sheet, swipe down. **Expected:** Sheet closes (saved content per §2).
- [ ] Attempt swipe-to-delete on a card. **Expected:** No delete-by-swipe on cards (delete only via sheet/trash per §5).

---

## 5. Move row in sheet; זבל restore / permanent delete

- [ ] In edit sheet, tap another page name in the move row (not **זבל** trash styling). **Expected:** Task moves to that page; sheet closes.
- [ ] In sheet, tap red **trash**-styled control (move to **זבל**). **Expected:** Task on **זבל**; sheet closes.
- [ ] On **זבל**, open task → tap **restore** icon. **Expected:** Task returns to its previous page (or **עבודה**); sheet closes.
- [ ] On **זבל**, tap **permanent-delete** icon. **Expected:** Confirmation dialog; confirm removes task permanently.

---

## 6. Photos — permissions, camera, gallery, lifecycle (bugfix)

_Use real device; first run may show Android permission dialogs._

- [ ] Open task sheet → tap camera button **📷** → choose **מהגלריה**. **While permission dialog is visible:** sheet stays open or returns when dialog dismisses (not destroyed). **Expected:** After **Allow**, chosen image appears on task.
- [ ] Close sheet, reopen same task. **Expected:** Photo still attached.
- [ ] Repeat **📷** → **צלם** (capture). **Expected:** Same sheet behavior during permission; photo appears after **Allow**; persists after close/reopen.
- [ ] Deny permission once (gallery or camera). **Expected:** Sheet remains; task not deleted; no crash.
- [ ] New unsaved task (FAB **+**) → add photo before naming → close and reopen. **Expected:** Task and photo both remain.
- [ ] **צלם** → background app from camera UI → return (and if possible trigger process death). Reopen app. **Expected:** Photo attaches to same task; that task is shown/editable.

---

## 7. WhatsApp share

- [ ] Task with text + at least one photo → tap green share icon in sheet → pick WhatsApp (or share target). **Expected:** Share sheet includes task text and photo file(s).

---

## 8. Reminders

- [ ] Tap clock icon → set quick chip and/or datetime → save/close sheet. **Expected:** Reminder saved on task.
- [ ] At fire time, notification appears. **Expected:** Actions **נודניק 10 דק׳**, **נודניק שעה**, **בוצע** present.
- [ ] **נודניק 10 דק׳** or **נודניק שעה**. **Expected:** Notification reschedules (fires again later).
- [ ] **בוצע**. **Expected:** Reminder cleared for that task.
- [ ] Tap notification body. **Expected:** App opens task edit sheet.
- [ ] Set reminder when notification permission first requested. **Expected:** Edit sheet not destroyed by permission dialog.

---

## 9. Address, Photon, Waze / Maps, location

- [ ] In address field, type 3+ Hebrew letters. **Expected:** Photon suggestions list appears.
- [ ] Tap one suggestion. **Expected:** Field filled; **W** (Waze) and **G** (Maps) enabled/open external app with destination.
- [ ] Tap current-location **◎**. **Expected:** Coordinates filled (and maps actions remain usable if applicable).

---

## 10. Contacts picker

- [ ] Tap person icon beside phone field (first time: contacts permission). **Expected:** System contact picker opens; sheet stays open after pick/cancel where applicable.
- [ ] Pick a contact. **Expected:** Phone filled; if task name was empty, display name filled.

---

## 11. Undo

- [ ] After a move, edit, or delete, tap header **undo** arrow **or** toast **בטל**. **Expected:** Last action reverted (card position/content/restored as before action).

---

## 12. Pinch text scaling

- [ ] Two-finger pinch on board/cards (~0.8–1.6 range). **Expected:** Text size changes visibly.
- [ ] Force-close app, reopen. **Expected:** Chosen scale persists.

---

## 13. Google sign-in / Drive backup

- [ ] If test Google account available: tap cloud → **התחבר עם Google** → **גבה עכשיו** → **שחזר מ-Drive** (smoke). **Expected:** Sign-in works; backup/restore completes; **local tasks not wiped** on sign-in.
- [ ] If no test account: mark **SKIPPED** — reason: __________. **Expected:** N/A.

---

## 14. Persistence after force-stop

- [ ] Create task with name, phone, note, photo, reminder. Android Settings → force-stop **המשימות של רן**. Reopen app. **Expected:** All fields, photo, and reminder intact (on-device encrypted store; no cloud required).

---

## 15. Data-safety spot check

- [ ] Force-stop app, reopen. **Expected:** No red banner **לא הצלחנו לקרוא את המשימות השמורות**.
- [ ] After force-stop/reboot cycle, open board. **Expected:** Tasks still present; board not replaced by empty state.

---

**Tester notes / failures:**

_______________________________________________

_______________________________________________