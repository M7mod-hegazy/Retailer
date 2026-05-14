# API Contract: Authentication & Users

**Base**: `/api/auth` and `/api/users`

## Auth Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /auth/login | ❌ | `{ username, password }` | `{ token, user, requires_mfa? }` |
| POST | /auth/mfa/login | ❌ (temp_token) | `{ temp_token, totp_code }` | `{ token, user }` |
| POST | /auth/mfa/setup | ✅ | — | `{ secret, qr_code_url }` |
| POST | /auth/mfa/verify | ✅ | `{ totp_code }` | `{ ok, backup_codes }` |
| POST | /auth/mfa/disable | ✅ | `{ totp_code }` | `{ ok }` |
| POST | /auth/mfa/backup | ❌ (temp_token) | `{ backup_code }` | `{ token, user }` |
| POST | /auth/unlock | ✅ | `{ pin_code }` | `{ ok }` |
| POST | /auth/supervisor-override | ✅ | `{ action, supervisor_pin, context }` | `{ authorized, supervisor_id }` |
| POST | /auth/change-password | ✅ | `{ current, new_password }` | `{ ok }` |

## User Endpoints

| Method | Path | Auth | Role | Body / Params |
|--------|------|------|------|---------------|
| GET | /users | ✅ | admin | `?page&limit&role&search` |
| POST | /users | ✅ | admin | `{ name, username, password, role, permissions }` |
| GET | /users/:id | ✅ | admin | — |
| PUT | /users/:id | ✅ | admin | `{ name, role, permissions, is_active }` |
| DELETE | /users/:id | ✅ | admin | Soft delete |
| POST | /users/:id/unlock-account | ✅ | admin | Reset lockout |
| POST | /users/:id/force-logout | ✅ | admin | Clear active_session_token |

## Standard Response

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

## Error Codes

| Code | HTTP | Arabic |
|------|------|--------|
| NO_TOKEN | 401 | لم يتم توفير رمز المصادقة |
| INVALID_TOKEN | 401 | رمز المصادقة غير صالح |
| TOKEN_EXPIRED | 401 | انتهت صلاحية الجلسة |
| USER_INACTIVE | 401 | الحساب غير مفعل |
| USER_LOCKED | 423 | الحساب مقفل مؤقتاً |
| WRONG_CREDENTIALS | 401 | اسم المستخدم أو كلمة المرور غير صحيحة |
| FORBIDDEN | 403 | ليس لديك صلاحية لهذا الإجراء |
