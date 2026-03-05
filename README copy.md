# Device FOV Identificator

Web app em TypeScript (Vite) para abrir no celular via rede local e exibir:
- preview ao vivo da câmera ativa,
- modelo do aparelho (UA-CH com fallback para UA string),
- FOV horizontal estimado + confiança + incerteza,
- fonte principal da estimativa (`WebXR`, `Catálogo`, `Heurística`).

## Pipeline de estimativa

1. `WebXR projectionMatrix` (quando disponível e autorizado).
2. Catálogo local versionado por modelo/lente.
3. Heurística por lente/capabilities da câmera ativa.

Sem calibração obrigatória no fluxo principal.

## Requisitos

- Node.js 20+
- pnpm 10+
- (Opcional, recomendado) `mkcert` para certificado HTTPS LAN mais controlado

## Instalação

```bash
pnpm install
```

## HTTPS LAN (recomendado)

Gerar certificado local:

```bash
pnpm setup:https
```

Depois iniciar servidor:

```bash
pnpm dev:lan
```

O terminal mostra uma dica de URL LAN (`https://<IP>:5173`).

### Confiar certificado no Android (para reduzir bloqueio de câmera)

Sem confiança no certificado, alguns devices bloqueiam o contexto seguro para câmera.

1. Exporte a CA local do `mkcert` no computador:
   ```bash
   mkcert -CAROOT
   ```
2. Copie o arquivo `rootCA.pem` para o celular.
3. Em Android, instale em `Configurações > Segurança > Criptografia e credenciais > Instalar certificado`.
4. Reinicie o Chrome e abra novamente a URL HTTPS LAN.

Se você não quiser instalar CA no celular, o app ainda inicia com certificado autoassinado do Vite, mas o comportamento pode variar por aparelho.

## Rodar no celular (Chrome Android)

1. Conecte celular e computador na mesma rede Wi‑Fi.
2. Abra a URL LAN exibida no terminal.
3. Conceda permissão de câmera.
4. Toque em **Iniciar câmera**.

## Sobre confiança

- `Alta`: score >= 0.80
- `Média`: 0.60-0.79
- `Baixa`: < 0.60

Mesmo em confiança baixa, o app mantém a estimativa com aviso visual explícito.

## Testes

```bash
pnpm test
```

## Build

```bash
pnpm build
```

## Limitações conhecidas

- Nem todo browser expõe `userAgentData.model`.
- `WebXR immersive-ar` depende de suporte e permissões do device.
- Sem calibração, existe erro residual; por isso o app sempre mostra margem de incerteza.
