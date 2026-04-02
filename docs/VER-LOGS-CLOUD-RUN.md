# Ver logs do Cloud Run (FinMemory)

## 1. Logs do Cloud Run (projeto **exalted-entry-480904-s9**)

1. Abra: **[Logging – projeto exalted-entry-480904-s9](https://console.cloud.google.com/logs/query?project=exalted-entry-480904-s9)**  
2. Em **Consulta**, pode usar algo como:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="finmemory"
   ```

## 2. Pelo menu Cloud Run

1. Abra: **[Cloud Run – Serviços](https://console.cloud.google.com/run?project=exalted-entry-480904-s9)**  
2. Clique no serviço **finmemory** → separador **Registros** / **Logs**.

## 3. Linha de comando

```bash
gcloud config set project exalted-entry-480904-s9
gcloud run services logs read finmemory --region=southamerica-east1 --limit=50
```

## 4. Erro em uma rota concreta (ex.: login)

1. [Cloud Run](https://console.cloud.google.com/run?project=exalted-entry-480904-s9) → serviço **finmemory**.  
2. **Registros** → filtre pelo caminho (`/api/auth/...`) ou pelo código de estado HTTP.

> Não uses o projeto **`finmemory-667c3`** para estes links — foi descontinuado.
