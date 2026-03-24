# Cloudflare Tunnel Deployment

Dwell works behind a Cloudflare Tunnel with **zero code changes**.
Share links, WebSocket connections, and API calls all auto-detect the
public URL from the request at runtime.

## Setup (5 minutes)

### 1. Install cloudflared

```bash
# Debian / Ubuntu
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# macOS
brew install cloudflared
```

Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### 2. Authenticate

```bash
cloudflared tunnel login
cloudflared tunnel create dwell
cloudflared tunnel route dns dwell yourdomain.com
```

### 3. Create `~/.cloudflared/config.yml`

```yaml
tunnel: <YOUR_TUNNEL_UUID>
credentials-file: /root/.cloudflared/<YOUR_TUNNEL_UUID>.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:5173
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

### 4. Start the app and tunnel

```bash
./start.sh                       # starts Dwell
cloudflared tunnel run dwell # starts the tunnel
```

That's it. Open `https://yourdomain.com` — no other changes needed.

---

## How It Works (No Config Needed)

| What | How |
|---|---|
| API calls | Relative URLs (`/api/v1/...`) — always call same host the page loaded from |
| WebSocket | URL derived from `window.location` at runtime: `https://` → `wss://` |
| Share links | Backend reads `Origin` header from each request |
| CORS | Set to `*` — the Vite proxy is the only public port |
| Trusted headers | uvicorn runs with `--proxy-headers` for Cloudflare's forwarded IP headers |

---

## Run as a System Service

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## Troubleshooting

**WebSocket fails:**
```bash
# Verify backend is reachable from frontend container
docker exec dwell_frontend wget -q -O- http://backend:8000/health
```

**CORS errors in browser console:**
- Check that the tunnel domain matches what the browser shows in the address bar
- Cloudflare Tunnel always terminates TLS at the edge — the app receives HTTP internally, which is expected

**App not loading:**
```bash
docker compose logs -f frontend   # check Vite startup
docker compose logs -f backend    # check FastAPI startup
```
