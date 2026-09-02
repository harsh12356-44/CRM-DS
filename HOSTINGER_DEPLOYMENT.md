# Hostinger Node.js Deployment Guide - CRM-DS (HRM Pilot)

This zip package contains everything required to deploy the **CRM-DS (HRM Pilot Web App)** to **Hostinger Node.js Web Hosting**.

---

## 📦 What Is Included in This Package?
1. **`.next/`**: Pre-built optimized production build.
2. **`data/db.json`**: Primary database containing employee accounts, passwords, attendance records (days 1-31), leave requests, and company settings.
3. **`src/` & `public/`**: Source code, assets, and UI components.
4. **`prisma/`**: Prisma schema definition (`schema.prisma`).
5. **`package.json`**: Dependencies and scripts (`"start": "next start"`).
6. **`server.js`**: Production Node.js entry point script.
7. **`HANDOFF.md`**: Master project handoff reference.

---

## 🚀 Step-by-Step Hostinger Deployment Instructions

### Step 1: Create a Node.js Application in Hostinger
1. Log into your **Hostinger hPanel**.
2. Navigate to **Websites** -> **Manage** -> **Node.js** (or search for **Node.js**).
3. Click **Create Application** (or Setup Node.js app).
4. Configure the settings:
   - **Node.js Version**: Select `18.x` or `20.x` (recommended `20.x`).
   - **Application Root**: `public_html` (or your target subfolder e.g. `crm`).
   - **Application URL**: Select your domain name.
   - **Application Startup File**: `server.js` (or leave default to run `npm start`).

---

### Step 2: Upload Project Files
1. Open Hostinger **File Manager** (under **Files** in hPanel).
2. Upload the `crm-ds-hostinger-deployment.zip` file into your application root folder.
3. Extract the `.zip` archive inside the root directory.
4. Verify that `.next/`, `data/db.json`, `package.json`, and `server.js` are present.

---

### Step 3: Install Dependencies
1. In Hostinger hPanel Node.js dashboard, click **Run NPM Install** (or access terminal via SSH and run `npm install --omit=dev`).
2. This installs required production packages (`next`, `react`, `@prisma/client`, `xlsx`, `lucide-react`).

---

### Step 4: Start the Node.js Application
1. In Hostinger Node.js dashboard, click **Start Application** (or **Restart Application**).
2. Access your domain URL (e.g., `https://your-domain.com/employee` or `https://your-domain.com/login`).
3. Login using existing credentials:
   - **Admin**: `digitalsuncityoffice@gmail.com` / `Ravina@1996#`
   - **Manager**: `jigyasa.digitalsuncity@gmail.com` / `Jigyasa@JS003`
   - **Employee**: `sonu.digitalsuncity@gmail.com` / `Sonu@SG012`

---

## ✅ Post-Deployment Verification
- Ensure `data/db.json` has write permissions (`644` or `664`) so attendance grid edits and password updates persist seamlessly on Hostinger.
