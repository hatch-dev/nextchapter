# Deploying to a live server

How to put the app on a live server, and how to fix the errors that usually show
up on the first try. For the system design see [architecture.md](architecture.md).

Live target: **https://nextchapter.org/app/enterprise/**, an Ubuntu server
running Apache 2.4 (`Server: Apache/2.4.58 (Ubuntu)`) — a normal filesystem
deploy, not a cPanel account. Apache runs as the `www-data` user, which is the
detail behind most first-deploy 403s (§2).

The app is **path-independent**: it runs at the document root, in a subfolder, or
on a subdomain with no code edits. The frontend calls the API through the
relative path `api`, and the API derives its own URL prefix from where
`index.php` sits. Nothing hardcodes `/pipeline/enterprises`.

---

## 1. What goes on the server

Upload the contents of `apps/` — `index.php` and its `.htaccess` must sit at the
top of whatever folder the app is served from, with `config/`, `api/`,
`assets/`, `js/` and `templates/` beside it:

```
<docroot>/app/enterprise/          <- serves https://nextchapter.org/app/enterprise/
├── .htaccess                      <- the front-controller rewrite. Without it every
│                                     route below the root 404s.
├── index.php                      <- the URL you visit must land HERE
├── shell.html                     <- rendered by index.php, never served directly
├── config/catalogue.json          <- the roles and their programs
├── api/
├── assets/
├── js/
└── templates/
```

The app serves pretty URLs — `/app/enterprise/enterprises/innovation-pipeline`
— so the folder needs `mod_rewrite` and `AllowOverride All`. Nothing hardcodes
the install path: `index.php` derives it and emits a matching `<base href>`. See
[roles-and-modules.md](roles-and-modules.md) for the URL map.

**Upgrading an existing database.** `api/sql/schema.sql` already contains all of
this; these are for a database created before each change. Every one is
idempotent — safe to run twice — and additive, so an older client keeps working
against a migrated database:

```
mysql -u root -p < api/sql/roles.sql               # organizations.account_type
mysql -u root -p < api/sql/workspace-modules.sql   # one workspace per (org, module)
mysql -u root -p < api/sql/assignment-modules.sql  # one assignment per (org, module, step, member)
```

`assignment-modules.sql` is required by the current code: every program numbers
its steps 1.1 … 4.4, so before it, assigning someone to a step assigned them to
an unrelated step of the same number in every other program — and assignment
decides who may sign a step off.

The local folder is `apps` and the live one is `enterprise` — the name mismatch
is harmless, because nothing in the app depends on its own path.

`docs/` and `tools/` are not needed in production.

Neither are the standalone review builds, `enterprises/dev/` and `leaders/dev/`
— a self-contained copy of each program, served as plain files so a reviewer
can open one without signing in (`.htaccess` exempts them from the front
controller). They are 2.4 GB between them, mostly MP4, and each contains a full
unminified copy of that program's source. Ship them only to a review server,
and only knowingly.

> **Heads-up on size:** `assets/media/` is ~830 MB of MP4 and dominates the
> upload — use `rsync`, not FTP. See §6.

---

## 2. Fixing "Forbidden" (403)

A 403 means Apache located the files but refused to serve them — it never got as
far as running any PHP, so this is never a code bug.

### Read the error body first

Apache states the cause in the response body, and the wording splits the
diagnosis cleanly. Fetch it rather than reading the browser's rendered page:

```
curl -s https://nextchapter.org/app/enterprise/js/app.js
```

| Body text | Meaning |
|---|---|
| `Server unable to read htaccess file, denying access to be safe` | Apache can't **enter** the directory to look for `.htaccess`. The directory is missing its read/execute bits. |
| Plain `You don't have permission to access this resource.` | Apache entered the directory and found the file, but can't **read** the file itself. |

Probing each path narrows it to a single cause in one pass:

```
for u in / index.php js/ js/app.js assets/ api/; do
  printf "%-14s " "$u"
  curl -s "https://nextchapter.org/app/enterprise/$u" | grep -q "unable to read htaccess" \
    && echo "dir not traversable" || echo "plain 403 / ok"
done
```

### The cause: permissions (`www-data` can't read the upload)

This is what the live 403 turned out to be, and it is the overwhelmingly common
one. Apache runs as `www-data`, so **every** directory needs `755` and every
file `644`. FTP clients and `unzip` routinely write `700`/`600`, which leaves the
files readable only by the uploading user — Apache then 403s everything.

Note the giveaway: the parent `/app/` listed fine while `/app/enterprise/` and
everything under it 403'd. Correct perms above, wrong perms below.

Fix over SSH (`<docroot>` is the vhost's `DocumentRoot` — find it with
`apache2ctl -S` or by reading `/etc/apache2/sites-enabled/*.conf`):

```
cd <docroot>/app/enterprise
sudo find . -type d -exec chmod 755 {} \;
sudo find . -type f -exec chmod 644 {} \;
```

`755`/`644` are world-readable, so ownership usually doesn't need touching. If
the files were unpacked as `root` and you'd rather they belong to your deploy
user, `sudo chown -R $USER:www-data .` works too — but fix the modes first, as
that alone resolves it.

To stop it recurring, set the modes as part of the upload rather than after it:

```
rsync -av --chmod=D755,F644 ./apps/ user@nextchapter.org:<docroot>/app/enterprise/
```

### If it is *not* permissions

- **A stray `.htaccess` above the app.** A `Require all denied` in a parent
  folder is inherited. Check every level from the docroot down.
- **`Require`/`<Directory>` rules in the vhost** denying the path.
- **The URL doesn't point at the folder holding `index.php`.** Unzipping often
  creates a nested `enterprise/enterprise/`, putting the real file one level
  deeper. (Ruled out here — `/app/` contains exactly one entry, `enterprise/`.)

---

## 3. Database

Two schema files ship with the app — pick by how you're importing:

- **`sql/schema.sql`** — starts with `CREATE DATABASE`, so it builds the database
  and the tables in one go. Use this over SSH.
- **`sql/schema-hosted.sql`** — the same six tables *without*
  `CREATE DATABASE`/`USE`, for importing into a database that already exists
  (phpMyAdmin, or any host that forbids `CREATE DATABASE`).

### Over SSH (this server)

```
mysql -u root -p < api/sql/schema.sql
```

Then create a dedicated app user — **do not point the app at `root`**:

```sql
CREATE USER 'pipeline'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON pipeline.* TO 'pipeline'@'localhost';
FLUSH PRIVILEGES;
```

`SELECT/INSERT/UPDATE/DELETE` is everything the API does — withholding `DROP`
and `ALTER` limits the blast radius if the app is ever compromised.

### Credentials

Put them in `api/config/database.php`:

```php
return [
    'host'    => env('DB_HOST', '127.0.0.1'),
    'port'    => env('DB_PORT', '3306'),
    'name'    => env('DB_NAME', 'pipeline'),
    'user'    => env('DB_USER', 'pipeline'),
    'pass'    => env('DB_PASS', 'a-long-random-password'),
    'charset' => 'utf8mb4',
];
```

The XAMPP defaults (`root`, empty password) will fail on the live server — and
should, since an empty-password root user reachable by the web app is exactly
the thing to avoid.

Verify the tables landed — expect six: `organizations`, `users`, `messages`,
`notes`, `step_assignments`, `app_admin`:

```
mysql -u pipeline -p -e "SHOW TABLES;" pipeline
```

---

## 4. Configuration

`api/config/config.php` needs no edits — `base_path` is derived from
`SCRIPT_NAME` at runtime. Two settings are worth knowing:

- **`debug`** defaults to **off** in production, so a crash returns a generic
  message instead of leaking file paths. To read a real error during setup,
  temporarily set `'debug' => true`, reproduce, then turn it back off.
- **`cors_allowed_origins`** defaults to `*`. Since the frontend and API are on
  the same origin, you can tighten this to your domain
  (`'cors_allowed_origins' => 'https://nextchapter.org'`).

---

## 5. Verifying the deployment

Run this from anywhere — it checks the app loads, the API answers, and the
source stays private:

```
B=https://nextchapter.org/app/enterprise
for u in "/" "/api/admin-session" "/api/sql/schema.sql" "/api/config/database.php"; do
  printf "%-28s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "$B$u")"
done
```

| Check | Expect |
|---|---|
| `/app/enterprise/` | `200` — the app loads. |
| `/app/enterprise/api/admin-session` | `200` `{"success":true,"data":{"exists":…}}` |
| `/app/enterprise/api/sql/schema.sql` | `403` — source stays private. |
| `/app/enterprise/api/config/database.php` | `403` — credentials stay private. |

Reading a failure:

- **Page loads but every API call 404s** — `mod_rewrite` is off
  (`sudo a2enmod rewrite && sudo systemctl reload apache2`) or the vhost has
  `AllowOverride None`, which makes Apache ignore `api/.htaccess` entirely. It
  needs `AllowOverride All` on the directory.
- **API 500s** — check `/var/log/apache2/error.log`. Usually a DB credential
  problem; set `'debug' => true` in `api/config/config.php` temporarily to see
  the real message, then set it back.
- **`403` on `/api/admin-session` specifically** — the rewrite is working but
  the `RewriteRule ^(config|core|…)` guard matched something it shouldn't.

---

## 6. Things that behave differently in production

**Team Chat.** Instant delivery comes from `tools/chat-server.js`, a Node
WebSocket relay on port 8090. Unless you run that as a service, it won't exist
in production — but that is not fatal: the app falls back to polling
`GET /messages` every 4 seconds, so chat still works, just not instantly. MySQL
is the source of truth either way.

Making it truly real-time on this server means running the relay under systemd
and proxying it, because `js/features/chat.js` builds a plain `ws://` URL, which
browsers block on an HTTPS page (mixed content). It needs `wss://` behind an
Apache reverse proxy:

```apache
# in the vhost, with: a2enmod proxy proxy_wstunnel
ProxyPass        /ws/ ws://127.0.0.1:8090/
ProxyPassReverse /ws/ ws://127.0.0.1:8090/
```

…and `CHAT_WS_URL` in `js/features/chat.js` changed to derive `wss://` from
`location.host` + `/ws/`. Leave this until the app itself is up.

**Media.** The ~830 MB in `assets/media/` is the bulk of the upload and the slow
part of any deploy. Prefer `rsync` (it resumes and skips unchanged files):

```
rsync -avz --chmod=D755,F644 assets/media/ user@nextchapter.org:<docroot>/app/enterprise/assets/media/
```

Longer term, moving the videos to a CDN or YouTube keeps deploys small.

**Don't upload `docs/` or `tools/`.** Neither is needed to run the app.

**Directory listing is on.** `https://nextchapter.org/app/` currently returns a
browsable index of the folder, which advertises your structure to anyone. Turn
it off in the vhost (or a parent `.htaccess`) with `Options -Indexes`.

**HTTPS.** Already working on nextchapter.org — keep the app on it. The app
posts PINs and passcodes to the API; over plain HTTP those travel in the clear.
