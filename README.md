# core-customer

Servicio core para experiencia customer de loyalty.

## Ownership
Este repo pertenece al **equipo Go**.

## Estado actual
Placeholder inicial de contrato y estructura. Aún no contiene implementación real del servicio.

## Objetivo
Exponer datos base del cliente para consumo por BFFs:
- perfil
- tier
- wallet summary
- estado general
- membership
- activity

## Contrato mínimo esperado
Ver documentación transversal en:
- `../docs/architecture/core-customer-contract.md`

## Endpoints objetivo
- `GET /health`
- `GET /v1/customers/me`
- `GET /v1/customers/me/tier`
- `GET /v1/customers/me/membership`
- `GET /v1/customers/me/wallet-summary`
- `GET /v1/customers/me/activity`

## Nota
El modelado e implementación final debe seguir la decisión arquitectónica del proyecto:
- DDD light
- hexagonal / clean architecture
- Go como stack principal del core
