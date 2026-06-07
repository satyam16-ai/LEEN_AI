# Deployment Guide

> Manual deployment guide for the AI Personal Teacher System.

---

## Architecture

```
                    Internet
                       │
                       ▼
              ┌────────────────┐
              │     Nginx      │  Port 80/443
              │  Reverse Proxy │
              └───────┬────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   ┌──────────────┐     ┌─────────────────┐
   │  Static HTML │     │   FastAPI API    │
   │  React Build │     │   (Uvicorn)     │
   │   /          │     │   /api/*        │
   └──────────────┘     └────────┬────────┘
                                 │
                     ┌───────────┴───────────┐
                     │                       │
               ┌─────▼──────┐         ┌─────▼──────┐
               │ PostgreSQL  │         │   Redis    │
               │  Port 5432  │         │  Port 6379 │
               └─────────────┘         └────────────┘
```

Nginx serves the React static build at `/` and reverse-proxies `/api/*` requests to the FastAPI backend. Everything runs in Docker containers.

---

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker 24+ and Docker Compose 2.20+
- Domain name (optional, for SSL)
- Git

---

## Step-by-Step Deployment

### 1. Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### 2. Clone the Repository

```bash
cd /opt
git clone <your-repo-url> leen_ai
cd leen_ai
```

### 3. Configure Environment Variables

```bash
# Create production env files
cp .env.example .env
cp backend/.env.example backend/.env
```

**Edit `.env`** with production values:

```bash
nano .env
```

```env
APP_NAME=ai-personal-teacher
APP_ENV=production
APP_PORT=8000

POSTGRES_DB=leen_ai
POSTGRES_USER=leen
POSTGRES_PASSWORD=<GENERATE_A_STRONG_PASSWORD>

REDIS_HOST=redis
REDIS_PORT=6379
```

**Edit `backend/.env`:**

```bash
nano backend/.env
```

```env
APP_NAME=ai-personal-teacher
APP_ENV=production
APP_PORT=8000
DATABASE_URL=postgresql://leen:<SAME_STRONG_PASSWORD>@postgres:5432/leen_ai
REDIS_HOST=redis
REDIS_PORT=6379
```

> ⚠️ **Generate a strong password:** `openssl rand -base64 32`

### 4. Build and Start

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Verify all containers are running
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME            STATUS              PORTS
leen-nginx      Up                  0.0.0.0:80->80/tcp
leen-api        Up                  8000/tcp
leen-postgres   Up (healthy)        5432/tcp
leen-redis      Up (healthy)        6379/tcp
leen-web-build  Exited (0)
```

> `leen-web-build` exits after building — that's expected. It outputs the static files to a shared volume.

### 5. Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### 6. Verify

```bash
# Health check
curl http://localhost/api/v1/health

# Should return:
# {"status":"healthy","timestamp":"...","version":"v1"}

# Frontend
curl -I http://localhost/
# Should return: HTTP/1.1 200 OK
```

Open `http://<your-server-ip>` in a browser to see the landing page.

---

## Adding SSL (HTTPS)

### Option A: Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot -y

# Get certificate (stop nginx first)
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d yourdomain.com

# Copy certs
mkdir -p infrastructure/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infrastructure/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem infrastructure/ssl/
```

Update `nginx.prod.conf` to add SSL:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ... rest of existing config ...
}
```

Uncomment the SSL lines in `docker-compose.prod.yml` and restart:

```bash
docker compose -f docker-compose.prod.yml up -d --build nginx
```

### Auto-renewal

```bash
# Add cron job
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/leen_ai/docker-compose.prod.yml restart nginx" | sudo crontab -
```

---

## Updating the Application

### Pull and Rebuild

```bash
cd /opt/leen_ai

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Run new migrations (if any)
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### Zero-Downtime Update (Rolling)

```bash
# Rebuild API without stopping
docker compose -f docker-compose.prod.yml up -d --build --no-deps api

# Rebuild frontend
docker compose -f docker-compose.prod.yml up -d --build --no-deps web-build

# Restart nginx to pick up new static files
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Monitoring & Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx

# Check container resource usage
docker stats
```

---

## Backup & Restore

### Database Backup

```bash
# Backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U leen leen_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U leen leen_ai < backup_file.sql
```

### Automated Daily Backups

```bash
# Create backup script
cat > /opt/leen_ai/infrastructure/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/leen_ai"
mkdir -p "$BACKUP_DIR"
docker compose -f /opt/leen_ai/docker-compose.prod.yml exec -T postgres \
  pg_dump -U leen leen_ai | gzip > "$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz"
# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
EOF
chmod +x /opt/leen_ai/infrastructure/scripts/backup.sh

# Add cron job (daily at 2 AM)
echo "0 2 * * * /opt/leen_ai/infrastructure/scripts/backup.sh" | sudo crontab -
```

---

## Troubleshooting

### Containers won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs postgres

# Reset everything
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### Database connection errors

```bash
# Verify PostgreSQL is healthy
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U leen

# Check DATABASE_URL matches postgres credentials
docker compose -f docker-compose.prod.yml exec api env | grep DATABASE
```

### Nginx 502 Bad Gateway

The backend isn't ready yet. Check:

```bash
# Is the API container running?
docker compose -f docker-compose.prod.yml ps api

# Check API logs
docker compose -f docker-compose.prod.yml logs api

# Verify health endpoint directly
docker compose -f docker-compose.prod.yml exec api \
  curl -s http://localhost:8000/api/v1/health
```

### Disk space issues

```bash
# Clean up Docker
docker system prune -a --volumes

# Check disk
df -h
```

---

## Security Checklist for Production

- [ ] Change default PostgreSQL password
- [ ] Set `APP_ENV=production` in backend .env
- [ ] Enable SSL/HTTPS
- [ ] Set up firewall (allow only ports 80, 443, 22)
- [ ] Disable API docs (`/docs`, `/redoc`) in production (automatic when `APP_ENV=production`)
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up server monitoring (uptimerobot, etc.)
