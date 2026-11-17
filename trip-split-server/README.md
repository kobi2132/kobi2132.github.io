# השרת של חצי־חצי

שרת קטן (קובץ אחד, בלי תלויות) שמגיש את האפליקציה בכתובת https://mysplit.jacob-apps.co.il ומאחד את ההוצאות של כל הטלפונים באותו טיול.
כל טיול נשמר כקובץ JSON בתיקייה `data/`. מזהה הטיול הוא מחרוזת אקראית ארוכה שנמצאת רק בקישור ההזמנה.

## התקנה על השרת (פעם אחת)
1. `mkdir -p /srv/apps/trip-split/data && chown 1000:1000 /srv/apps/trip-split/data`
2. להעתיק לשם את `server.mjs` ואת `compose.yaml`, ואת כל הקבצים של התיקייה `trip-split/` (האפליקציה) אל `/srv/apps/trip-split/public/`.
3. `cd /srv/apps/trip-split && docker compose up -d`
4. להוסיף את הבלוק מ־`Caddyfile.trip-split` אל `/srv/proxy/Caddyfile` ולטעון מחדש את Caddy.
5. רשומת DNS מסוג A עבור `mysplit.jacob-apps.co.il` לכתובת השרת (אם אין wildcard).

## עדכון
אפליקציה: להעתיק את הקבצים החדשים של `trip-split/` אל `public/` (בלי הפעלה מחדש). שרת: להעתיק את `server.mjs` החדש ולהריץ `docker compose restart app`.

## גיבוי
כל המידע נמצא ב־`/srv/apps/trip-split/data`.

## מה עוד השרת עושה
- `GET /api/rates`: שערי מטבע יומיים מ־open.er-api.com (חינם, בלי מפתח), נשמרים בזיכרון 6 שעות.
- `PUT/GET /api/trips/<id>/receipts/<rid>`: צילומי קבלות (JPEG עד 3MB), נשמרים ב־`data/receipts/<id>/`.

## גיבוי
`/srv/apps/trip-split/backup.sh` רץ כל לילה ב־03:40 ושומר 30 לילות ב־`/srv/backups/trip-split` (כולל הקבלות).
