#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# OpsConsole — EC2 Deployment Script
# Run this on a fresh Amazon Linux 2023 or Ubuntu 22.04 EC2 instance
# 
# Prerequisites:
#   1. EC2 instance with IAM Role attached (read-only policies)
#   2. Security Group: inbound 22, 80, 443
#   3. SSH access
#
# Usage:
#   chmod +x deploy.sh && sudo ./deploy.sh
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
APP_NAME="opsconsole"
APP_DIR="/home/ec2-user/$APP_NAME"
REPO_URL="${1:-}"  # Pass repo URL as first arg, or it will prompt
AWS_REGION="${2:-ap-south-1}"
NODE_VERSION="20"
PORT=3000

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     OpsConsole — EC2 Deployment Script       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect OS ─────────────────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  err "Cannot detect OS"
fi
log "Detected OS: $OS"

# ── Prompt for repo URL if not passed ─────────────────────────────
if [ -z "$REPO_URL" ]; then
  read -p "$(echo -e ${YELLOW}'Enter your Git repo URL (or local path): '${NC})" REPO_URL
fi
[ -z "$REPO_URL" ] && err "Repo URL is required"

# ── Step 1: Install system dependencies ───────────────────────────
log "Step 1/6 — Installing system packages..."

if [[ "$OS" == "amzn" || "$OS" == "rhel" || "$OS" == "centos" ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
  yum install -y nodejs git nginx > /dev/null 2>&1
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
  apt-get install -y nodejs git nginx > /dev/null 2>&1
  APP_DIR="/home/ubuntu/$APP_NAME"
else
  err "Unsupported OS: $OS. Use Amazon Linux 2023 or Ubuntu 22.04"
fi

ok "Node.js $(node --version), npm $(npm --version), git, nginx installed"

# ── Step 2: Install PM2 ──────────────────────────────────────────
log "Step 2/6 — Installing PM2..."
npm install -g pm2 > /dev/null 2>&1
ok "PM2 $(pm2 --version) installed"

# ── Step 3: Clone & build app ─────────────────────────────────────
log "Step 3/6 — Setting up application..."

if [ -d "$APP_DIR" ]; then
  warn "Directory $APP_DIR exists — pulling latest..."
  cd "$APP_DIR"
  git pull 2>/dev/null || true
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

ok "Source code ready at $APP_DIR"

# Create .env.local (IAM Role — no credentials needed)
cat > .env.local << EOF
# IAM Role provides credentials automatically — no keys needed
AWS_DEFAULT_REGION=$AWS_REGION
NEXT_PUBLIC_AWS_DEFAULT_REGION=$AWS_REGION
EOF
ok ".env.local configured (region: $AWS_REGION, using IAM Role)"

log "Installing npm packages..."
npm install --production=false > /dev/null 2>&1
ok "Dependencies installed"

log "Building production bundle (this takes ~30s)..."
npm run build
ok "Production build complete"

# ── Step 4: Start with PM2 ────────────────────────────────────────
log "Step 4/6 — Starting application with PM2..."

pm2 delete "$APP_NAME" 2>/dev/null || true
cd "$APP_DIR"
pm2 start npm --name "$APP_NAME" -- start
pm2 save
pm2 startup -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
ok "App running on port $PORT"

# ── Step 5: Configure Nginx ───────────────────────────────────────
log "Step 5/6 — Configuring Nginx reverse proxy..."

# Get public IP for server_name
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "_")

NGINX_CONF="/etc/nginx/conf.d/$APP_NAME.conf"
cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $PUBLIC_IP _;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }

    # Cache static assets
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$PORT;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Remove default nginx page
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t > /dev/null 2>&1 || err "Nginx config test failed"
systemctl restart nginx
systemctl enable nginx
ok "Nginx configured → http://$PUBLIC_IP"

# ── Step 6: Summary ──────────────────────────────────────────────
log "Step 6/6 — Verifying deployment..."

sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/ 2>/dev/null || echo "000")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Complete! 🎉              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard URL:   ${CYAN}http://$PUBLIC_IP${NC}"
echo -e "  Local port:      ${CYAN}http://localhost:$PORT${NC}"
echo -e "  Health check:    ${CYAN}HTTP $HTTP_CODE${NC}"
echo -e "  Region:          ${CYAN}$AWS_REGION${NC}"
echo -e "  Process:         ${CYAN}pm2 status${NC}"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    pm2 logs $APP_NAME         # View logs"
echo -e "    pm2 monit                  # Live monitor"
echo -e "    pm2 restart $APP_NAME      # Restart app"
echo ""

if [ "$HTTP_CODE" == "200" ]; then
  ok "Dashboard is live and responding!"
else
  warn "App may still be starting — check: pm2 logs $APP_NAME"
fi

echo -e "  ${YELLOW}For SSL (optional):${NC}"
if [[ "$OS" == "amzn" || "$OS" == "rhel" ]]; then
  echo -e "    sudo yum install -y certbot python3-certbot-nginx"
else
  echo -e "    sudo apt install -y certbot python3-certbot-nginx"
fi
echo -e "    sudo certbot --nginx -d your-domain.com"
echo ""
