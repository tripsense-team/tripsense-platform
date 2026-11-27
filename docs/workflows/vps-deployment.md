# TripSense Ubuntu VPS Deployment

TripSense production deploys to a GitHub Actions self-hosted runner on an x86_64 Linux VPS. The current supported host is Ubuntu 24.04. Cloud-provider-specific APIs are not required.

## Host Baseline

- Ubuntu 24.04 x86_64
- 6 vCPU, 12 GB RAM, and at least 70 GB disk recommended for the full stack
- Public DNS pointing to the VPS
- Inbound TCP ports 22, 80, and 443
- Docker Engine with the Docker Compose v2 plugin

Verify the host before registration:

```bash
cat /etc/os-release
uname -m
```

`uname -m` must report `x86_64` for the current `X64` runner label and published images.

## Install Host Dependencies

Run as the administrative user on the VPS:

```bash
apt-get update
apt-get install -y ca-certificates curl git gettext-base ufw
curl -fsSL https://get.docker.com | sh
```

Create a non-root deployment user and grant Docker access:

```bash
adduser --disabled-password --gecos "" tripsense
usermod -aG docker tripsense
mkdir -p /opt/tripsense/deploy/nginx
chown -R tripsense:tripsense /opt/tripsense
```

Log in again as `tripsense`, then verify:

```bash
docker version
docker compose version
```

## Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

Restrict SSH at the VPS provider firewall to trusted administrator IPs whenever possible.

## Register the GitHub Actions Runner

In GitHub, open `Settings -> Actions -> Runners -> New self-hosted runner`, select Linux x64, and run the generated commands as the `tripsense` user.

Configure the runner with the custom label required by both CD workflows:

```bash
./config.sh --url https://github.com/tripsense-team/tripsense-platform \
  --token GITHUB_GENERATED_TOKEN \
  --labels tripsense-vps \
  --unattended
sudo ./svc.sh install tripsense
sudo ./svc.sh start
sudo ./svc.sh status
```

Do not store the short-lived runner registration token in this repository.

## Runtime Environment

Create `/opt/tripsense/.env` directly on the VPS using `env/.env.example` as the field reference. Never commit the production file.

```bash
install -o tripsense -g tripsense -m 600 /dev/null /opt/tripsense/.env
nano /opt/tripsense/.env
```

At minimum, supply every variable listed in `REQUIRED_VARS` in `scripts/deploy.sh`, plus:

```dotenv
IMAGE_REGISTRY=docker.io
IMAGE_OWNER=your-dockerhub-owner
IMAGE_PROJECT=tripsense
IMAGE_TAG=latest
SSL_DOMAIN=your-domain.example.com
SSL_EMAIL=admin@example.com
WEB_APP_URL=https://your-domain.example.com
PAYOS_RETURN_BASE_URL=https://your-domain.example.com
AI_ALLOWED_ORIGINS=https://your-domain.example.com
ALLOWED_ORIGINS=https://your-domain.example.com
```

The production Compose file expects the primary PostgreSQL, MongoDB, and Redis connections to be externally reachable. Only the disposable Context Redis cache runs locally in the production stack.

## GitHub Repository Secrets

Configure the Docker Hub credentials and frontend build-time values under `Settings -> Secrets and variables -> Actions`. The CD workflows require `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`; the web image also consumes the `NEXT_PUBLIC_*` values declared in the workflows.

Backend runtime secrets belong only in `/opt/tripsense/.env`.

## Deploy

- `.github/workflows/cd.yml` deploys automatically on pushes to `dev` and `main`.
- `.github/workflows/cd-vps-manual.yml` provides the manual deployment entry point and targets the same `tripsense-vps` runner.
- Both workflows share the `tripsense-cd-vps` concurrency group, preventing simultaneous deployments to the VPS.

Inspect the deployment on the server:

```bash
cd /opt/tripsense/deploy
docker compose -p tripsense --env-file /opt/tripsense/.env ps
docker compose -p tripsense --env-file /opt/tripsense/.env logs --tail=200
```

The deploy script renders Nginx configuration from the checked-in templates and bootstraps or renews Let's Encrypt certificates. DNS must already resolve to the VPS before the first deployment.

## Security After Provisioning

Disable direct root SSH after key-based access for the deployment user has been verified:

```text
PermitRootLogin no
PasswordAuthentication no
```

Apply these settings in `/etc/ssh/sshd_config.d/`, validate with `sshd -t`, and reload SSH only while an existing administrative session remains open.
