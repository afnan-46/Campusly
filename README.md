# Campusly

Appointments and campus reports for **schools, colleges and universities** in Bangladesh.
Campusly is sold to institutions as a monthly subscription. Students and teachers always use it free.

* **Frontend:** React 18, React Router, Vite (installable PWA, works offline for saved pages)
* **Backend:** Node.js, Express, JWT, bcrypt, Multer
* **Database:** MongoDB

## What is inside

| Part | Who uses it | Where |
|------|-------------|-------|
| Public site: Home, Plans & Pricing, Apply, Check application | Anyone | `/` |
| Sign in (type your ID or email, Campusly finds your institution) | Everyone | `/login` |
| Join with a class code | New students | `/join` |
| Company portal: applications, institutions, payments, revenue, team | Campusly owner and office staff | `/company` |
| Institution admin: people, Excel/CSV import, join codes, sign-up approvals, billing | School / college / university admin | after sign-in |
| Student, teacher and office staff screens | Institution members | after sign-in |

Plans: **Starter ৳2,000**, **Standard ৳5,000**, **Premium ৳12,000** per month.
6 months −10%, 12 months −15%. 14-day free trial. Payment by bKash or Nagad transaction ID.

## Run it on your computer

You need **Node.js 18+** and **MongoDB** running locally
(MongoDB Community Server, optionally with MongoDB Compass to look at the data).
The default address is `mongodb://127.0.0.1:27017/campusly`.

```bash
npm run install-all     # installs root, server and client (no loops)
npm run build           # builds the client
npm start               # starts the API and serves the site on http://localhost:5000
```

For development with auto reload (API on 5000, site on 5173):

```bash
npm run dev
```

To use another MongoDB (for example Atlas), copy `server/.env.example` to `server/.env`
and set `MONGO_URI`. Also set a long random `JWT_SECRET` before going live.

### Demo data

The first start fills an empty database with demo data. To wipe and refill it: `npm run seed`.

| Who | Sign in with | Password |
|-----|--------------|----------|
| Campusly owner | `owner@campusly.com.bd` at **Campusly staff login** | `owner123` |
| Campusly office staff | `rina@campusly.com.bd` / `imran@campusly.com.bd` | `company123` |
| EWU admin | `admin@ewubd.edu` | `admin123` |
| Student | `2023-1-60-145` | `student123` |
| Class code to join | `CSE26A` | |

### Windows notes

* Extract the zip into a **single** folder. Do not leave `campusly\campusly` nested.
* Use `npm run install-all`, not plain `npm install` in the root. It installs each part once
  and skips install scripts, which avoids the endless-install loop.
* If port 5000 is busy, set `PORT=5055` in `server/.env`.

## How subscriptions work

1. An institution applies on the public site (trial or paid with a TrxID).
2. The Campusly team approves it in the company portal. This creates the institution and its
   admin, and shows a temporary password to pass on. The admin must change it at first sign-in.
3. Renewals are sent by the admin from **Billing** with a TrxID. The company team verifies them in **Payments**.
4. When a plan ends or is suspended, the institution is **paused**: students and teachers see a neutral
   "access paused, please contact your administrator" notice. Only the admin can open Billing to renew.

## Offline

Pages you have opened are saved on the device and stay readable without internet.
Problem reports written offline are queued and sent when the connection returns.
The app can be installed to the home screen from the browser menu.

## Not built yet (planned)

SMS alerts, a native Android app, and Bluetooth / Wi-Fi Direct messaging for campuses with no internet.
