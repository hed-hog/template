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
# Tip: use your cluster UUID as K8S_CLUSTER_ID
doctl kubernetes cluster kubeconfig save <your-cluster-uuid>
```

### 2. Verify Namespace

```bash
# Verify the namespace exists
kubectl get namespace <your-namespace>
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
kubectl create namespace <your-namespace> --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/api/ -n <your-namespace>
kubectl apply -f k8s/admin/ -n <your-namespace>
```

#### Additional infrastructure services (generated from docker-compose.yaml)

The CLI generated Helm charts for the selected services under `helm/services` using the same image names and versions from compose.

Run the following commands to create these services in your cluster:

```bash
helm upgrade --install <project>-postgres ./helm/services/postgres --namespace <your-namespace> --create-namespace
```


#### Option 2: Build and deploy application images

```bash
docker build -t <your-registry>/<project>-api:latest -f apps/api/Dockerfile .
docker push <your-registry>/<project>-api:latest
kubectl set image deployment/<project>-api <project>-api=<your-registry>/<project>-api:latest -n <your-namespace>
kubectl rollout status deployment/<project>-api -n <your-namespace>

docker build -t <your-registry>/<project>-admin:latest \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://<your-api-domain> \
  --build-arg INTERNAL_API_URL=http://<project>-api:3100 \
  -f apps/admin/Dockerfile .
docker push <your-registry>/<project>-admin:latest
kubectl create configmap <project>-admin-config \
  -n <your-namespace> \
  --from-literal=NEXT_PUBLIC_API_BASE_URL='https://<your-api-domain>' \
  --from-literal=INTERNAL_API_URL='http://<project>-api:3100' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl set image deployment/<project>-admin <project>-admin=<your-registry>/<project>-admin:latest -n <your-namespace>
kubectl rollout status deployment/<project>-admin -n <your-namespace>
```

## Monitoring

### Check Deployment Status

```bash
# Check pods
kubectl get pods -n <your-namespace>

# Check deployments
kubectl get deployments -n <your-namespace>

# Check services
kubectl get services -n <your-namespace>

# View logs
kubectl logs -f deployment/<project>-api -n <your-namespace>
kubectl logs -f deployment/<project>-admin -n <your-namespace>
```

### Scaling

```bash
# Scale a deployment
kubectl scale deployment/<project>-api --replicas=3 -n <your-namespace>
kubectl scale deployment/<project>-admin --replicas=3 -n <your-namespace>
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/<project>-api -n <your-namespace>
kubectl rollout history deployment/<project>-admin -n <your-namespace>

# Rollback to previous version
kubectl rollout undo deployment/<project>-api -n <your-namespace>
kubectl rollout undo deployment/<project>-admin -n <your-namespace>
```

## Troubleshooting

### View Pod Events

```bash
kubectl describe pod <pod-name> -n <your-namespace>
```

### View Cluster Events

```bash
kubectl get events -n <your-namespace> --sort-by='.lastTimestamp'
```

### Access Pod Shell

```bash
kubectl exec -it deployment/<project>-api -n <your-namespace> -- /bin/sh
kubectl exec -it deployment/<project>-admin -n <your-namespace> -- /bin/sh
```

## URLs

- **Admin Panel:** https://\<your-admin-domain\>
- **API:** https://\<your-api-domain\>


## Further Reading

- [Digital Ocean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Helm Documentation](https://helm.sh/docs/)

