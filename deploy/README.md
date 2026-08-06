# استقرار روی یک سرور ابری

نوشته‌شده برای سرور اوبونتوی پارس‌پک، ولی هیچ‌چیزش مخصوص پارس‌پک نیست — هر
سرور اوبونتو ۲۲/۲۴ با دسترسی root همین است.

پروژه روی **هاست اشتراکی اجرا نمی‌شود**. لازم دارد: Node.js ۲۰ به بالا،
PostgreSQL (نه MySQL)، و دو پروسهٔ دائم. cPanel و DirectAdmin هیچ‌کدام را کامل
نمی‌دهند.

## سروری که کافی است

| | |
|---|---|
| سیستم‌عامل | Ubuntu 24.04 LTS |
| رم | ۲ گیگ (۴ گیگ راحت‌تر — `next build` پرمصرف‌ترین لحظه است) |
| پردازنده | ۲ هسته |
| دیسک | ۲۰ گیگ |
| موقعیت | **بیرون ایران** |

موقعیت شوخی نیست: خودِ وب‌سرور باید به نود زنجیره برسد. `verifyTransfer` در
چهار مسیر درخواستی صدا زده می‌شود — تأیید پرداخت فاکتور، تأیید تسویه،
بازپرداخت، و `/api/chain/verify` — و هیچ‌کدام قابل واگذاری به یک پروسهٔ دیگر
نیست. سروری که به RPC نرسد، سامانه‌ای است که نمی‌تواند هیچ پرداختی را تأیید
کند. `api.resend.com` هم همین‌طور، اگر ایمیل را از Resend می‌فرستید.

---

## ۰. وصل شدن به سرور

پس از خرید، پارس‌پک نشانی IP و رمز `root` را می‌دهد. از ترمینال خودتان
(روی مک و لینوکس ترمینال، روی ویندوز PowerShell):

```bash
ssh root@نشانی-IP-سرور
```

بار اول می‌پرسد این سرور را می‌شناسید یا نه — `yes` بزنید. بعد رمز را می‌خواهد؛
موقع تایپ چیزی روی صفحه نمی‌آید، این طبیعی است.

اگر خط فرمان به `root@...:~#` تغییر کرد، داخل سرورید. از این به بعد هر
دستوری که در این راهنما هست، **روی همین خط فرمان** اجرا می‌شود، نه روی کامپیوتر
خودتان.

اول از همه سیستم را به‌روز کنید:

```bash
apt-get update && apt-get upgrade -y
```

> در ادامه پیش `sudo` نوشته شده. اگر با `root` وارد شده‌اید `sudo` لازم نیست و
> بودنش هم مشکلی نمی‌سازد.



در پنل مدیریت DNS پارس‌پک، روی دامنهٔ اصلی یک رکورد **A** بسازید:

| نوع | نام | مقدار | TTL |
|---|---|---|---|
| A | `panel` | نشانی IP سرور | ۳۶۰۰ |

اگر IPv6 دارید، یک رکورد **AAAA** با همان نام هم اضافه کنید.

از روی خود سرور بررسی کنید که پخش شده — تا وقتی این جواب ندهد، Let's Encrypt
گواهی نمی‌دهد:

```bash
dig +short panel.example.ir
```

> از اینجا به بعد هرجا `panel.example.ir` نوشته شده، زیردامنهٔ خودتان را
> بگذارید.

## ۲. آماده‌سازی سرور

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL، nginx، certbot، git
sudo apt-get install -y postgresql nginx certbot python3-certbot-nginx git

# کاربری که برنامه با آن اجرا می‌شود — بدون شل، بدون رمز
sudo adduser --system --group --home /srv/afa --shell /usr/sbin/nologin afa
```

### فایروال

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

پستگرس عمداً باز نمی‌شود. برنامه از روی همان سرور به `127.0.0.1` وصل می‌شود و
دیتابیسی که از اینترنت دیده شود، دیر یا زود پیدا می‌شود.

### دیتابیس

```bash
sudo -u postgres psql <<'SQL'
CREATE USER afa WITH PASSWORD 'یک-رمز-قوی-اینجا';
CREATE DATABASE afa OWNER afa;
SQL
```

## ۳. آوردن کد

مخزن خصوصی است، پس یک کلید استقرار بسازید و در GitHub زیر
**Settings → Deploy keys** ثبتش کنید (دسترسی فقط-خواندن کافی است):

```bash
sudo install -d -m 700 -o afa -g afa /srv/afa/.ssh
sudo -u afa -H ssh-keygen -t ed25519 -N '' -f /srv/afa/.ssh/id_ed25519
sudo cat /srv/afa/.ssh/id_ed25519.pub
```

بعد:

```bash
sudo -u afa -H git clone git@github.com:bahramgg/Afa-freezone.git /srv/afa/app
```

> ساده‌تر: مخزن را روی سرور clone نکنید و با `rsync` بفرستید. ولی آن‌وقت
> به‌روزرسانی بعدی هم دستی است؛ `git pull` یک خط است.

## ۴. پیکربندی

```bash
sudo -u afa -H cp /srv/afa/app/.env.example /srv/afa/app/.env
sudo -u afa -H chmod 600 /srv/afa/app/.env
sudo -u afa -H nano /srv/afa/app/.env
```

`.env` تنها جای پیکربندی است — هم Next خودش می‌خواندش، هم Prisma، هم رصدگر.
مقدارهایی که باید عوض شوند:

```ini
DATABASE_URL="postgresql://afa:همان-رمز@127.0.0.1:5432/afa?schema=public"

# openssl rand -base64 48
AUTH_SECRET="..."

# ── زنجیره: سپولیا، با قراردادهایی که همین حالا مستقرند ──────────────────
CHAIN_ID=11155111
CHAIN_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
CHAIN_EXPLORER_URL="https://sepolia.etherscan.io"
USDT_CONTRACT_ADDRESS=0x71606E770C1E484312435C6b3d57Bf3c9DBA19F1
USDT_DECIMALS=6
GATEWAY_FACTORY_ADDRESS=0xac5dc87cac1a9d143770fe3b92d3c7f8e2c8a9fc

GATEWAY_WALLET=0xcc4E7F08F00a6953264c892D55e65a7Eb125680E
FREEZONE_WALLET=0x62c2B0fD185Eac1EE037c04E6CFFf7AB6202253B
BANK_TREASURY_WALLET=0x5cE617d0C0a999d9b2D54c2eB124b8CBB1a21a10
GATEWAY_FEE_PERCENT=2
FREEZONE_SHARE_PERCENT=50
GATEWAY_FEE_MIN=1
GATEWAY_FEE_MAX=0

CHAIN_FINALITY="finalized"
CHAIN_SCAN_BATCH=200
CHAIN_SCAN_MAX_REQUESTS=40
# openssl rand -hex 24
CHAIN_WATCHER_TOKEN="..."

# این دو داخل جاوااسکریپت مرورگر پخته می‌شوند — عوض کردنشان یعنی build دوباره.
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CHAIN_EXPLORER_URL="https://sepolia.etherscan.io"

# ── ایمیل ورود ──────────────────────────────────────────────────────────
EMAIL_PROVIDER="resend"
EMAIL_FROM="AFA <no-reply@example.ir>"
RESEND_API_KEY="..."

# ── حساب‌های اولیه (فقط هنگام seed خوانده می‌شوند) ───────────────────────
SEED_ADMIN_EMAIL="..."
SEED_ADMIN_PASSWORD="..."
SEED_BANK_EMAIL="..."
SEED_BANK_PASSWORD="..."
SEED_BANK_RECEIVE_WALLET=0x5cE617d0C0a999d9b2D54c2eB124b8CBB1a21a10

AUTH_OPEN_ACCESS=false
```

> **`EMAIL_FROM` باید روی دامنه‌ای باشد که نزد Resend تأیید شده.** وگرنه هر
> ایمیل رد می‌شود و هیچ‌کس نمی‌تواند وارد شود. تأیید دامنه یعنی چند رکورد TXT و
> CNAME که Resend می‌دهد و شما در همان پنل DNS پارس‌پک ثبت می‌کنید.

> **این کیف پول‌ها آزمایشی‌اند.** هر سه از یک عبارت بازیابیِ تستی مشتق شده‌اند
> که برای سپولیا ساخته شده. پیش از هر پولی که واقعاً ارزش دارد باید با کیف
> پول‌های واقعی عوض شوند و فکتوری دوباره مستقر شود — شرایط تقسیم در خودِ نشانی
> واریز پخته می‌شود، پس تغییر `.env` به‌تنهایی هیچ‌چیز را عوض نمی‌کند.

## ۵. ساخت و راه‌اندازی دیتابیس

```bash
cd /srv/afa/app
sudo -u afa -H npm ci
sudo -u afa -H npm run build
sudo -u afa -H npm run db:migrate
sudo -u afa -H npm run db:seed
sudo -u afa -H npm run check:chain
```

`npm ci` وابستگی‌های توسعه را هم نصب می‌کند و باید بکند: هم `next build` و هم
رصدگر (که با `tsx` اجرا می‌شود) به آن‌ها نیاز دارند.

`check:chain` آخرین فرصت برای دیدن یک اشتباه پیکربندی است، پیش از آنکه کسی
فاکتوری صادر کند. باید بگوید `Chain configuration OK` و توکن را با شش رقم اعشار
نشان دهد.

## ۶. دو سرویس

```bash
sudo cp deploy/afa-web.service deploy/afa-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now afa-web afa-watcher
sudo systemctl status afa-web afa-watcher
```

برنامه روی `127.0.0.1:3000` می‌نشیند و از بیرون دیده نمی‌شود. لاگ‌ها:

```bash
sudo journalctl -u afa-web -f
sudo journalctl -u afa-watcher -f
```

## ۷. nginx و گواهی

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/afa
sudo sed -i 's/PANEL.EXAMPLE.IR/panel.example.ir/g' /etc/nginx/sites-available/afa
sudo ln -s /etc/nginx/sites-available/afa /etc/nginx/sites-enabled/afa
sudo rm -f /etc/nginx/sites-enabled/default

sudo certbot --nginx -d panel.example.ir
sudo nginx -t && sudo systemctl reload nginx
```

certbot خودش تمدید خودکار را می‌گذارد؛ با `systemctl list-timers | grep certbot`
می‌شود دیدش.

## ۸. بررسی نهایی

- [ ] `https://panel.example.ir` بالا می‌آید و قفل سبز دارد.
- [ ] `http://panel.example.ir` به HTTPS منتقل می‌شود.
- [ ] با ایمیل ادمین وارد می‌شوید و کد به‌دستتان می‌رسد.
- [ ] `sudo journalctl -u afa-watcher -n 50` نشان می‌دهد که دارد بلوک می‌خواند.
- [ ] در ۳۹۰ پیکسل هیچ اسکرول افقی در صفحه نیست.
- [ ] `curl -sI https://panel.example.ir | grep -i strict-transport` پاسخ دارد.
- [ ] `sudo ss -lntp | grep 3000` فقط `127.0.0.1` را نشان می‌دهد، نه `0.0.0.0`.

## به‌روزرسانی

```bash
cd /srv/afa/app
sudo -u afa -H git pull
sudo -u afa -H npm ci
sudo -u afa -H npm run build
sudo -u afa -H npm run db:migrate
sudo systemctl restart afa-web afa-watcher
```

مهاجرت‌ها را همیشه پیش از راه‌اندازی دوباره اجرا کنید، نه بعدش: نسخهٔ جدید کد
ستونی را می‌خواهد که مهاجرت می‌سازد.

### وقتی فقط `.env` عوض می‌شود

```bash
sudo systemctl restart afa-web afa-watcher
```

`build` لازم نیست. متغیرهای سمت سرور در همان لحظهٔ درخواست خوانده می‌شوند —
آزموده شد: مقدار نامعتبری در `.env` گذاشته شد و فقط با راه‌اندازی دوباره،
بی‌آنکه build اجرا شود، برنامه آن را دید و درخواست را رد کرد.

استثنا `NEXT_PUBLIC_*` است. آن دو داخل جاوااسکریپتی که به مرورگر می‌رود پخته
می‌شوند، پس عوض کردنشان `npm run build` هم می‌خواهد.

## پشتیبان

دیتابیس تنها چیزی است که با clone دوباره برنمی‌گردد.

```bash
sudo -u postgres pg_dump afa | gzip > /var/backups/afa-$(date +%F).sql.gz
```

بگذاریدش در یک cron روزانه و جایی بیرون از همین سرور نگهش دارید. دفترکل سامانه
اینجاست؛ سروری که از دست برود و پشتیبان نداشته باشد، یعنی هیچ‌کس نمی‌داند چه
کسی چقدر طلبکار بود.

## وقتی چیزی کار نمی‌کند

اولین کار همیشه یکی است: **لاگ را بخوانید.** خطای واقعی آنجاست، نه در صفحه‌ای
که به کاربر نشان داده می‌شود.

```bash
sudo journalctl -u afa-web -n 80 --no-pager
sudo journalctl -u afa-watcher -n 80 --no-pager
sudo tail -n 50 /var/log/nginx/error.log
```

| نشانه | معنی معمولش |
|---|---|
| مرورگر: `502 Bad Gateway` | `afa-web` بالا نیست. `systemctl status afa-web` و بعد لاگش. |
| لاگ: `Invalid environment configuration` | مقداری در `.env` جا افتاده یا شکلش غلط است. خودِ پیام می‌گوید کدام. |
| لاگ: `database ... does not exist` یا `password authentication failed` | `DATABASE_URL` با کاربر و رمزی که در مرحلهٔ ۲ ساختید نمی‌خواند. |
| `certbot` می‌گوید دامنه را تأیید نکرد | رکورد A هنوز پخش نشده. `dig +short panel.example.ir` باید IP سرور را بدهد. |
| `nginx -t`: `unknown directive "http2"` | nginx قدیمی‌تر از ۱٫۲۵. پیکربندی این مخزن شکل سازگار را دارد؛ اگر دستکاری‌اش کردید برگردانید. |
| `nginx`: `Address family not supported` | سرور IPv6 ندارد ولی خط `listen [::]` باز است. کامنتش کنید. |
| کد ورود نمی‌رسد | `EMAIL_FROM` روی دامنهٔ تأییدشده نیست، یا `RESEND_API_KEY` غلط است. برای دیدنِ کد بدون ایمیل، موقتاً `EMAIL_PROVIDER="console"` بگذارید و کد را در لاگ `afa-web` ببینید. |
| پرداختی روی زنجیره انجام شده ولی فاکتور باز مانده | `afa-watcher` را ببینید. تا وقتی درست شود، اپراتور می‌تواند هش تراکنش را دستی ثبت کند و همان راستی‌آزمایی روی زنجیره اعمال می‌شود. |

پس از هر تغییر در `.env`:

```bash
sudo systemctl restart afa-web afa-watcher
```
