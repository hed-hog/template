# Deployment Guide

This project is configured for deployment to **Digital Ocean Kubernetes** using **GitHub Actions**.

## Prerequisites

Make sure you have the following tools installed:

- `kubectl` - Kubernetes CLI
- `doctl` - Digital Ocean CLI
- `gh` - GitHub CLI
- `helm` - Kubernetes package manager

## Initial Setup

### 1. Configure Digital Ocean

```bash
# Authenticate with Digital Ocean
doctl auth init

# Get your cluster kubeconfig
# Tip: use your cluster UUID as K8S_CLUSTER_ID (example: 05c7d4fa-4bc2-4dbf-80b6-757ecec43bff)
doctl kubernetes cluster kubeconfig save 05c7d4fa-4bc2-4dbf-80b6-757ecec43bff
```

### 2. Verify Namespace

```bash
# Verify the namespace exists
kubectl get namespace hcode
```

### 3. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. `DIGITALOCEAN_ACCESS_TOKEN` - Your Digital Ocean API token
2. `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_SECRET`, and `PEPPER` - API runtime secrets required by the deploy workflow

You can configure the application secrets directly from the CLI by rerunning:

```bash
hedhog dev deploy-config
```

The CLI can ask for `DIGITALOCEAN_ACCESS_TOKEN` and `DATABASE_URL`, generate the random values for `JWT_SECRET`, `ENCRYPTION_SECRET`, and `PEPPER`, and publish everything with `gh secret set`.

If you skip that step, you can still add the token manually later:

```bash
gh secret set DIGITALOCEAN_ACCESS_TOKEN
```



## Deployment

### Using GitHub Actions (Automatic)

Push to the `production` branch:

```bash
git add .
git commit -m "Deploy to production"
git push origin production
```

The GitHub Actions workflow will automatically:
1. Apply cluster configuration (namespace, Kubernetes manifests, and Helm charts)
2. Build and push application Docker images
3. Update deployments and wait for rollout

### Manual Deployment

#### Option 1: Apply cluster config manually (same as workflow)

```bash
kubectl create namespace hcode --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/api/ -n hcode
kubectl apply -f k8s/admin/ -n hcode
```

#### Additional infrastructure services

The production database is **not** deployed by the workflow. Its source of truth is
`infra/digitalocean/do-k8s/helm/postgresql/stateful-hub.yaml`, applied by hand:

```bash
kubectl --context do-nyc3-hcode apply -f infra/digitalocean/do-k8s/helm/postgresql/stateful-hub.yaml
```

> Editing the StatefulSet template recreates `postgresql-hub-0` — expect ~30-60s of
> downtime, and every API/worker pod loses its Prisma connections in the process.
>
> The probes there declare `timeoutSeconds` explicitly. Omitting the field means the
> Kubernetes default of **1s**, not "no limit": on 2026-08-14 `pg_isready` went over
> it, the liveness probe killed the database and it entered a kill → recovery → kill
> loop (Sentry issue `API-E`). Do not remove those values.


#### Option 2: Build and deploy application images

```bash
docker build -t hcode/hub-api:latest -f apps/api/Dockerfile .
docker push hcode/hub-api:latest
kubectl set image deployment/hub-api hub-api=hcode/hub-api:latest -n hcode
kubectl rollout status deployment/hub-api -n hcode

docker build -t hcode/hub-admin:latest \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://hub-api.hcode.com.br \
  --build-arg INTERNAL_API_URL=http://hub-api:3100 \
  -f apps/admin/Dockerfile .
docker push hcode/hub-admin:latest
kubectl create configmap hub-admin-config \
  -n hcode \
  --from-literal=NEXT_PUBLIC_API_BASE_URL='https://hub-api.hcode.com.br' \
  --from-literal=INTERNAL_API_URL='http://hub-api:3100' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl set image deployment/hub-admin hub-admin=hcode/hub-admin:latest -n hcode
kubectl rollout status deployment/hub-admin -n hcode
```

## Monitoring

### Check Deployment Status

```bash
# Check pods
kubectl get pods -n hcode

# Check deployments
kubectl get deployments -n hcode

# Check services
kubectl get services -n hcode

# View logs
kubectl logs -f deployment/hub-api -n hcode
kubectl logs -f deployment/hub-admin -n hcode
```

### Scaling

```bash
# Scale a deployment
kubectl scale deployment/hub-api --replicas=3 -n hcode
kubectl scale deployment/hub-admin --replicas=3 -n hcode
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/hub-api -n hcode
kubectl rollout history deployment/hub-admin -n hcode

# Rollback to previous version
kubectl rollout undo deployment/hub-api -n hcode
kubectl rollout undo deployment/hub-admin -n hcode
```

## Troubleshooting

### View Pod Events

```bash
kubectl describe pod <pod-name> -n hcode
```

### View Cluster Events

```bash
kubectl get events -n hcode --sort-by='.lastTimestamp'
```

### Access Pod Shell

```bash
kubectl exec -it deployment/hub-api -n hcode -- /bin/sh
kubectl exec -it deployment/hub-admin -n hcode -- /bin/sh
```

## URLs

- **Admin Panel:** https://hub.hcode.com.br
- **API:** https://api.hub.hcode.com.br


## Further Reading

- [Digital Ocean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Helm Documentation](https://helm.sh/docs/)

