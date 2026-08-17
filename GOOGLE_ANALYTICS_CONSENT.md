# Google Analytics consent implementation

Measurement ID: `G-2R960Q7K9C`

## How it works

- The Google tag library is present in the document head so Google Tag Assistant and the Analytics installation test can detect it.
- Consent Mode v2 defaults `analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization` to `denied`.
- `send_page_view` is disabled during initialization.
- A page view is sent only after the visitor explicitly accepts analytics.
- The choice is stored in `localStorage`.
- The footer **Cookie settings** button reopens the banner.
- Withdrawing consent removes `_ga` and `_ga_*` cookies.
- The Nginx Content Security Policy allows the Google tag and Google Analytics collection endpoints.

## Validate locally

```bash
npm ci
npm run check
npm run build
```

## Deploy

```bash
docker compose build --no-cache portfolio
docker compose up -d --force-recreate portfolio
```

If the reverse proxy is also managed by this Compose project, reload it after deployment:

```bash
docker compose exec reverse-proxy nginx -t
docker compose exec reverse-proxy nginx -s reload
```

## Browser verification

1. Open the production site in a private browser window with extensions disabled.
2. In DevTools → Network, confirm `gtag/js?id=G-2R960Q7K9C` returns HTTP 200.
3. Before accepting, confirm no `_ga` cookie exists.
4. Accept analytics and confirm a request such as `g/collect` appears and `_ga` cookies are created.
5. Reopen **Cookie settings**, reject analytics, and confirm the cookies are removed.
6. Use Google Tag Assistant to verify the default denied state and the update to granted after acceptance.

Reset the stored choice from the browser console with:

```js
localStorage.removeItem("portfolio.analytics-consent");
location.reload();
```
