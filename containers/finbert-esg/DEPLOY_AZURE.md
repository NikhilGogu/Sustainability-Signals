# FinBERT-ESG-9 (Azure Container Apps)

This folder contains a Dockerized HTTP inference server for `yiyanghkust/finbert-esg-9-categories`.

The app exposes:

- `GET /health`
- `POST /classify` with JSON body `{ "inputs": "..." }` or `{ "inputs": ["...", "..."] }`

If `FINBERT_API_KEY` is set in the container, `POST /classify` requires header `x-api-key: <key>`.

## Deploy (Azure CLI, EU Region)

Prereqs:

- Azure CLI (`az`)
- Docker running locally (we build + push the image from your machine)

If `az` is not recognized in PowerShell, add it for the current session:

```powershell
$env:Path += ";C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin"
```

### Choose A Region (EU)

Some subscriptions (notably **Azure for Students**) enforce allowed deployment regions. If you hit a policy error, pick a location from your allowed list.

Example allowed EU locations (seen on Azure for Students):

- `francecentral`
- `spaincentral`
- `germanywestcentral`
- `polandcentral`
- `swedencentral`

```powershell
$rg   = "ss-finbert-rg"
$loc  = "germanywestcentral"
$app  = "finbert-esg"
$acaEnv = "finbert-esg-env"

# Pick a globally-unique ACR name (5-50 chars, letters/numbers only).
$acr  = ("ssfinbert" + ([guid]::NewGuid().ToString("N").Substring(0, 12))).ToLowerInvariant()

az login
az group create -n $rg -l $loc

cd containers/finbert-esg

# Container registry for the image
az acr create -n $acr -g $rg -l $loc --sku Basic
az acr login -n $acr

$image = "$acr.azurecr.io/finbert-esg:latest"
docker build -t $image .
docker push $image

# Container Apps environment (creates a Log Analytics workspace automatically)
az containerapp env create -n $acaEnv -g $rg -l $loc

# Create the public Container App, using a system-assigned identity for ACR pulls
az containerapp create -n $app -g $rg -l $loc `
  --environment $acaEnv `
  --image $image `
  --ingress external --target-port 8080 `
  --system-assigned `
  --registry-server "$acr.azurecr.io" `
  --registry-identity system

# Optional: protect /classify with an API key.
$apiKey = "<generate-a-random-key>"
az containerapp secret set -n $app -g $rg --secrets finbertkey=$apiKey
az containerapp update -n $app -g $rg --set-env-vars FINBERT_API_KEY=secretref:finbertkey

# Get the public base URL
$fqdn = az containerapp show -n $app -g $rg --query properties.configuration.ingress.fqdn -o tsv
$baseUrl = "https://$fqdn"
$baseUrl
```

Notes:

- `az containerapp up --source .` is convenient, but it can fail on some subscriptions because it uses ACR build tasks. The manual `docker build/push` flow above works without ACR tasks.
- If you want fewer cold starts, consider: `az containerapp update -n $app -g $rg --min-replicas 1` (costs more).

## Wire Into Cloudflare Pages Functions

In your Cloudflare Pages project environment variables (Functions):

- `FINBERT_URL` = the Azure Container Apps base URL (e.g. `https://<fqdn>`)
- `FINBERT_API_KEY` = same key as the container secret (optional)

The Pages Functions call the service via `functions/_lib/finbert-router.js`.

## Quick Smoke Test

```powershell
$baseUrl = "https://<fqdn>"
$apiKey  = "<key-or-empty>"

$headers = @{ "Content-Type" = "application/json" }
if ($apiKey) { $headers["x-api-key"] = $apiKey }

Invoke-RestMethod "$baseUrl/health" -Method Get

Invoke-RestMethod "$baseUrl/classify" -Method Post -Headers $headers -Body (@{ inputs = @(
  "We reduced Scope 1 and 2 emissions by 25% year-on-year.",
  "The board approved an updated ethics policy."
) } | ConvertTo-Json)
```
