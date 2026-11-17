# שרת הסנכרון של חצי־חצי

שרת קטן (קובץ אחד, בלי תלויות) שמאחד את ההוצאות של כל הטלפונים באותו טיול.
כל טיול נשמר כקובץ JSON בתיקייה `data/`. מזהה הטיול הוא מחרוזת אקראית ארוכה שנמצאת רק בקישור ההזמנה.

## התקנה על השרת (פעם אחת)
1. `mkdir -p /srv/apps/trip-split/data && chown 1000:1000 /srv/apps/trip-split/data`
2. להעתיק לשם את `server.mjs` ואת `compose.yaml`.
3. `cd /srv/apps/trip-split && docker compose up -d`
4. להוסיף את הבלוק מ־`Caddyfile.trip-split` אל `/srv/proxy/Caddyfile` ולטעון מחדש את Caddy.
5. רשומת DNS מסוג A עבור `trip.jacob-apps.co.il` לכתובת השרת (אם אין wildcard).

## עדכון
להעתיק את `server.mjs` החדש ולהריץ `docker compose restart app`.

## גיבוי
כל המידע נמצא ב־`/srv/apps/trip-split/data`.
