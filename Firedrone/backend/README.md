# Backend do FireDrone

API HTTP em Python **sem dependências** (biblioteca padrão) que executa o **mesmo motor JavaScript** da interface (`../core`) via Node.
Requisitos: Python 3.9+ e Node.js 18+.

    python app.py [--port 8000] [--host 127.0.0.1]

Variáveis de ambiente: `NODE` (caminho do node), `FIREDRONE_MAX_JOBS` (execuções simultâneas, padrão 2; cada uma usa todos os núcleos), `FIREDRONE_LOG=1`.

| Rota | O que faz |
|---|---|
| `GET /api/health` | versão do Node e nº de jobs |
| `GET /api/catalog` | 20 drones e 5 aeronaves tripuladas, 13 cenários (combustíveis) com valores padrão, 15 faixas de incerteza |
| `POST /api/resolve` | `{fuel_index, overrides, full}`: célula, grade e Δt escolhidos pelo código (`full` = teste de convergência) |
| `POST /api/jobs` | inicia uma execução em segundo plano → `{id}` |
| `GET /api/jobs/<id>` | `status` (queued/running/done/error/cancelled), `progress`, `elapsed_s` e `result` |
| `DELETE /api/jobs/<id>` | cancela |
| `POST /api/run` | executa e espera a resposta (pode levar minutos) |

## Pedido de execução (todos os campos opcionais)
`fuel_index` (0 a 12) · `overrides` (`area,a0,wind,wdir,slope,sdir,rh,temp,bdist,brel,delay,maxloss,opsyr,life,fixop,wcost`; `delay` em segundos) · `n` (frota máxima) · `model` (índice, -1 = comparar todos) · `compare` · `tactic` (`auto|direto|flancos|indireto|cercamento`) · `objective` (`custo|capex|drones`) · `rigor` (`mc|det`) · `alpha` (prob. mínima de contenção) · `K` (réplicas por teste) · `unc` (faixa de cada incerteza, ex. `{"wind":0.3}`) · `custom_models` (`name,pay,v,end,cx[,rf,ox,mtow,empty]`) · `mc_replicas` (distribuição final; 0 desliga) · `tornado` (bool) · `threads`.

## Resultado (principais campos)
`model`, `n_drones`, `n_min_single_run`, `fleet_capped`, `p_containment {P, ci, K, alpha}`, `tactic`, `contained_and_ok`, `burned_ha`, `burned_ha_without_drones`, `front_contained_min`, `fully_extinguished_min`, `water_m3`, `wet_line_m`, `costs {capex, opex_per_operation, total_per_operation, per_month}`, `resolution`, `optimization.table` (um registro por modelo), `tactics_table`, `mesh_robustness`, `sectors`, `rank`, `timeseries_ha`, `routes_peak_round`, `monte_carlo`, `tornado`.

Valores não finitos (por exemplo, nenhum modelo viável por autonomia) saem como `null`.


