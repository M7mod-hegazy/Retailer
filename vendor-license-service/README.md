# Vendor License Service

Central service for issuing and managing signed licenses for Retailer deployments.

## Run

```bash
cd vendor-license-service
npm install
npm start
```

## Security model

- Private signing key stays only on this service.
- Buyer app stores only public key for signature verification.
- License management endpoints require `x-admin-key`.
- App activation endpoints require `x-app-key`.

## Main APIs

- `POST /licenses`
- `POST /licenses/:id/suspend`
- `POST /licenses/:id/resume`
- `POST /licenses/:id/revoke`
- `DELETE /licenses/:id`
- `POST /activations`
- `POST /activations/refresh`
- `POST /activations/rebind`
