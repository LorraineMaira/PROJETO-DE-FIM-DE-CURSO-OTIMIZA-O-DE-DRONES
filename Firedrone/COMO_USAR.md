# Como rodar o simulador FireDrone

## Opção 1: só a interface (mais simples, sem instalar nada)
1. Abra `frontend/index.html` no Chrome, Edge ou Firefox (duplo clique no arquivo), ou use o link publicado do artefato.
2. Tudo roda no navegador, inclusive a otimização completa (triagem dos 25 modelos (20 drones e 5 aeronaves tripuladas), frota com risco por Monte Carlo, tornado). Não precisa de backend.
3. As simulações rodam em Web Workers, em paralelo (um por núcleo, até 8): a tela não trava e o tempo cai com o número de núcleos. O rodapé da barra lateral mostra quantas threads estão em uso. Se o navegador bloquear Workers (alguns ambientes restritos), cai automaticamente para uma thread única, mais lenta.

Ao abrir, o simulador roda uma execução rápida determinística do cenário padrão para você já ver algo. A análise completa (com risco) é o botão ▶ Executar simulação.

## Opção 2: backend (API) para rodar em lote ou integrar com outros sistemas
Requisitos: Node.js 18+ e Python 3.9+. Não há dependências Python (`pip install` não é necessário).

    node --version                       # 18 ou superior
    cd backend
    python app.py                        # http://127.0.0.1:8000

- `http://localhost:8000/` serve a mesma interface. Ela continua calculando no navegador; o backend serve a página e expõe o mesmo motor pela API.
- O backend executa o mesmo código JavaScript da interface (`core/`) com `node runner.js`. Os números são idênticos aos do navegador (`tests/test_parity.py` confere isso).
