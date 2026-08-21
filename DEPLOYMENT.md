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
kubectl get namespace <namespace>
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
kubectl create namespace <namespace> --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/api/ -n <namespace>
kubectl apply -f k8s/admin/ -n <namespace>
```

#### Additional infrastructure services

The production database is **not** deployed by the workflow. Its source of truth is
`infra/digitalocean/do-k8s/helm/postgresql/stateful-hub.yaml`, applied by hand:

```bash
kubectl --context <kube-context> apply -f infra/digitalocean/do-k8s/helm/postgresql/stateful.yaml
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
docker build -t <registry>/<app>-api:latest -f apps/api/Dockerfile .
docker push <registry>/<app>-api:latest
kubectl set image deployment/<app>-api <app>-api=<registry>/<app>-api:latest -n <namespace>
kubectl rollout status deployment/<app>-api -n <namespace>

docker build -t <registry>/<app>-admin:latest \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.<your-domain> \
  --build-arg INTERNAL_API_URL=http://<app>-api:3100 \
  -f apps/admin/Dockerfile .
docker push <registry>/<app>-admin:latest
kubectl create configmap <app>-admin-config \
  -n <namespace> \
  --from-literal=NEXT_PUBLIC_API_BASE_URL='https://api.<your-domain>' \
  --from-literal=INTERNAL_API_URL='http://<app>-api:3100' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl set image deployment/<app>-admin <app>-admin=<registry>/<app>-admin:latest -n <namespace>
kubectl rollout status deployment/<app>-admin -n <namespace>
```

## Monitoring

### Check Deployment Status

```bash
# Check pods
kubectl get pods -n <namespace>

# Check deployments
kubectl get deployments -n <namespace>

# Check services
kubectl get services -n <namespace>

# View logs
kubectl logs -f deployment/<app>-api -n <namespace>
kubectl logs -f deployment/<app>-admin -n <namespace>
```

### Scaling

```bash
# Scale a deployment
kubectl scale deployment/<app>-api --replicas=3 -n <namespace>
kubectl scale deployment/<app>-admin --replicas=3 -n <namespace>
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/<app>-api -n <namespace>
kubectl rollout history deployment/<app>-admin -n <namespace>

# Rollback to previous version
kubectl rollout undo deployment/<app>-api -n <namespace>
kubectl rollout undo deployment/<app>-admin -n <namespace>
```

## Troubleshooting

### View Pod Events

```bash
kubectl describe pod <pod-name> -n <namespace>
```

### View Cluster Events

```bash
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Access Pod Shell

```bash
kubectl exec -it deployment/<app>-api -n <namespace> -- /bin/sh
kubectl exec -it deployment/<app>-admin -n <namespace> -- /bin/sh
```

## URLs

- **Admin Panel:** https://admin.<your-domain>
- **API:** https://api.<your-domain>


## Further Reading

- [Digital Ocean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Helm Documentation](https://helm.sh/docs/)

