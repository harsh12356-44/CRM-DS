# Time Tracker Update (v3) — Hostinger Deploy Guide

Is zip mein CRM-DS ka updated **Time Tracker** hai. Sirf Time Tracker badla hai —
login, office attendance (biometric / punch), leaves, payroll, employees sab pehle jaise hain.

## Kya badla (v3)
1. **Exactly 2 breaks — Tea (15 min) & Lunch (45 min).** Master Admin sirf duration badal sakta hai
   (Admin → Time Tracker → *Who Can Track* tab → **Break Settings (Master Admin)**).
   Negative / 0 / decimal / 180 se zyada value save nahi hoti (screen par error + server 400).
   Break ka naam/type ab server decide karta hai — koi custom break inject nahi kar sakta.
2. **Overtime = (Logged-in time − Tea − Lunch) − Daily required hours** (employee ka *Daily Working Requirement*).
   Example: 10h login − 15m − 45m = 9h worked → 8h target par **+1h OT**.
   Ek hi formula har jagah: employee dashboard, admin live board, Timesheets table,
   Summary CSV aur Detailed CSV (ab "Logged-in", "Break", "Worked = Logged-in − Break" columns bhi).
   Range/month mein OT = har din ka OT jod kar (kam din ka short, OT se cancel nahi hota).
3. **Screen permission sirf clock-in par** (browser ka official `getDisplayMedia`, "Entire Screen" preferred).
   Tea/Lunch break start/end par koi permission popup nahi. Break mein screenshots band;
   "Resume Work" par usi permission se ~5 sec mein capture phir shuru. Agar employee ne browser se
   sharing band kar di ya page reload kiya, tab browser apna native prompt dobara dikhata hai (ye browser rule hai).
4. **Har screenshot ke saath**: Employee naam + code, Date, Time (seconds tak, IST), full timestamp,
   aur session reference (time entry id + clock-in time). Admin gallery mein har thumbnail par date + time dikhte hain.
5. **Retention 7 din** (30 din wala rule hata diya). Purane saved "30" ko bhi automatically 7 maana jaata hai.
   7 din (168 ghante) se purana har screenshot **image file + index record dono** permanently delete.
   Attendance / time entries kabhi delete nahi hote. Master Admin retention 1–365 din set kar sakta hai.
   Cleanup kab chalta hai: server start ke 15 sec baad, phir **har ghante** (built-in scheduler),
   aur optional Hostinger cron (neeche Step 5).
6. **Admin Time Tracker mein ab SAARE employees** (sirf WFH nahi). Tracker har employee ke liye optional hai —
   jo on karega (khud apne portal se, ya HR "Turn on" button se) wahi track hoga. Live Board par
   filter: *All employees / Tracker on / Tracker off*, aur jinka tracker off hai unke card par "Tracker Off" dikhta hai.
   WFH work-mode wale employees ka tracker hamesha on rehta hai (pehle jaisa).
7. **Tracker hours attendance sheet mein KABHI add nahi hote.** Attendance Grid, Working Hours aur Payroll
   pehle jaise sirf biometric / punch data se chalte hain. Tracker ke hours alag dikhte hain:
   - Employee: *Time Tracker* tab (aaj, hafta, extra hours/OT).
   - Admin: *Time Tracker → Timesheets* (Worked, Break, Overtime/Extra, Target har employee ke liye).
   **Month-end process (HR):** Timesheets → **Last Month** button → **Summary CSV** download →
   har employee ke "Worked" / "Overtime / Extra Hours" HR khud manually attendance/payroll mein add kare.

---

## 📦 Zip mein kya hai
- `.next/` — fresh production build (Linux-compatible manifests)
- `src/`, `prisma/`, `public/`, `scripts/` (naya: `scripts/cleanup_screenshots.js`)
- `server.js`, `package.json`, `package-lock.json`, config files
- **`data/` folder NAHI hai** — Hostinger par live `data/db.json` aur `data/screenshots/` safe rahenge.

---

## 🚀 Hostinger par deploy (File Manager)

### Step 1: Backup
hPanel → **Files → File Manager** → app folder → `data/db.json` download kar lein.

### Step 2: Upload & Extract
1. App root folder mein `crm-ds-hostinger-deployment.zip` upload karein.
2. Right-click → **Extract** (same folder). Overwrite allow karein.
3. Check karein `data/db.json` wahi purana hai (size/date).

### Step 3: Dependencies
Hostinger **Node.js** dashboard → **Run NPM Install**
(SSH ho to: `npm install --omit=dev && npx prisma generate`).
Database change ki zarurat nahi — naye settings `data/db.json` mein apne aap save hote hain.
*(Agar Supabase `DATABASE_URL` use ho raha hai to ek baar `npx prisma db push`.)*

### Step 4: Restart
Node.js dashboard → **Restart Application**. Startup logs mein 15 sec baad (agar purane screenshots the) ye line dikhegi:
`[screenshots] retention 7d: deleted N screenshot(s) ...`

### Step 5 (optional, recommended): Cron backup cleanup
Hostinger idle hone par Node process ko sula deta hai, isliye ek daily cron bhi laga dein:
hPanel → **Advanced → Cron Jobs** → Daily (e.g. 03:00) → command:
```
cd /home/<user>/<app-folder> && /opt/alt/alt-nodejs20/root/bin/node scripts/cleanup_screenshots.js
```
(`<user>/<app-folder>` apne actual path se badlein.) Ye sirf 7 din se purane screenshots hataata hai.

---

## ✅ Deploy ke baad 2-minute check
1. Admin login → Time Tracker → *Who Can Track* → **Break Settings** mein Tea 15 / Lunch 45, Retention 7.
2. Kisi WFH employee se Clock In → browser "Share screen" (Entire Screen chunein) → Tea Break → Resume Work
   (permission dobara nahi maangni chahiye) → Clock Out.
3. Admin → Screenshots tab → thumbnail par date + time dikhna chahiye.
4. Admin → Timesheets → Worked / Break / Overtime columns.
