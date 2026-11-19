# Evorez ko live kaise karein — deploy guide

> **Status: already live** → https://evorez.vercel.app (Vercel project `evorez`).
> Neeche ke steps re-deploys, domain shift ya kisi doosre host par move karne ke liye hain.
> OG image + sitemap URLs ab live domain par point karte hain, to checklist ka point 1 aur 3 done hai.

Poora site ek static folder hai (`index.html` + `assets/`). Koi build step nahi, koi server-side
code nahi — matlab kisi bhi static host par chalega. Neeche 3 tareeke hain, upar wala sabse fast.

---

## Option 1 — Netlify Drop (sabse fast: ~2 minute, zero setup)

1. [app.netlify.com/drop](https://app.netlify.com/drop) kholiye.
2. Poora `evorez/` folder drag-and-drop kar dijiye (folder, sirf index.html nahi — `assets/` bhi saath jaana chahiye).
3. Turant ek URL mil jaayega jaise `https://evorez-xyz123.netlify.app`.
4. Free account banake site claim kar lijiye ( warna 1 ghante baad expire ho jaati hai), phir
   **Site settings → Change site name** se `evorez.netlify.app` kar dijiye.

Custom domain: **Domain management → Add a domain** → `evorez.com` → Netlify batayega 2 DNS
records (A + CNAME). Domain registrar par wahi records daal dijiye. HTTPS free aur automatic hai.

---

## Option 2 — GitHub Pages (recommended: free, permanent, `@evorez` ke saath match)

```bash
cd evorez
git init
git add .
git commit -m "Evorez landing page"
git branch -M main
git remote add origin https://github.com/evorez/evorez.github.io.git   # ya koi bhi repo
git push -u origin main
```

Phir GitHub par: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save.**

- Repo ka naam `evorez.github.io` hoga to site `https://evorez.github.io` par live hogi.
- Kisi doosre repo naam ke saath: `https://evorez.github.io/<repo-name>`.
- Custom domain: **Settings → Pages → Custom domain** mein `evorez.com` daaliye. GitHub repo mein
  apne aap `CNAME` file ban jaayegi. DNS mein `A` records:
  `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
  aur `www` ke liye CNAME → `evorez.github.io`. **Enforce HTTPS** tick kar dijiye.

Har `git push` par site khud update ho jaati hai.

---

## Option 3 — Cloudflare Pages / Vercel (best performance)

**Cloudflare Pages (dashboard):** [dash.cloudflare.com](https://dash.cloudflare.com) → Workers &
Pages → Create → Pages → *Upload assets* → folder upload kijiye. Free unlimited bandwidth + global CDN.

**CLI se:**

```bash
# Vercel
npx vercel deploy --prod            # pehli baar login maangega

# Cloudflare (wrangler)
npx wrangler pages deploy . --project-name evorez
```

Dono par custom domain add karna 1-click hai, HTTPS automatic.

---

## Deploy ke baad — 5 minute ka checklist

1. **OG image ka URL absolute kar dijiye.** `index.html` ke `<head>` mein
   `https://evorez.com/assets/og-cover.png` ko apne actual domain se replace kijiye — warna
   Telegram/X par link preview (1200×630 cover) nahi dikhega. Same `og:url` ke liye.
   Preview test: [opengraph.xyz](https://www.opengraph.xyz/) ya Telegram mein link bhej ke dekhein.
2. **Form ko asli endpoint se jodiye.** Abhi `#ctaForm` sirf client-side validate karke success
   message dikhata hai — koi email kahin nahi jaati. Sabse aasaan:
   - **Netlify Forms:** form tag mein `data-netlify="true"` + `name="beta"` add kar dijiye.
   - **Formspree / Tally / Getform:** form ka `action="https://formspree.io/f/xxxx"` + `method="POST"`
     kar dijiye (JS validation waise hi kaam karega).
   - Apna API: `form.addEventListener("submit", ...)` ke andar `fetch("/api/beta", {...})`.
3. **Sitemap/robots update:** `sitemap.xml` aur `robots.txt` mein `evorez.com` apne domain se badal dijiye.
4. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console))
   mein site add karke sitemap submit kijiye — "logon ko pata chale" wale goal ke liye yeh step
   sabse zyada matter karta hai.
5. **Analytics (optional, privacy-friendly):** [Plausible](https://plausible.io) ya
   [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) — ek script tag, no cookies.

---

## Local par test karna ho to

```bash
cd evorez
python3 -m http.server 8080      # phir browser mein: http://localhost:8080
```

(`index.html` ko direct double-click bhi kar sakte hain — sab kuch inline hai, phir bhi chalega.)

---

## Domain chahiye?

`.com` ~₹900–1,200/saal (Namecheap, Cloudflare Registrar, Porkbun). Registrar sasta rakhein,
DNS Cloudflare par daal dein — free CDN, fast DNS, aur HTTPS ek click.
