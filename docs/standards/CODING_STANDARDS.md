# Coding Standards

## General Principles

- Write clean, readable code. Favor clarity over cleverness.
- Follow the **DRY** (Don't Repeat Yourself) principle.
- Keep functions/methods small and focused (single responsibility).
- Use meaningful, descriptive names for variables, functions, and files.
- Always handle errors explicitly — never swallow exceptions silently.

---

## Python Standards (Backend)

### Type Hints

**Mandatory.** All functions must have type hints for parameters and return values.

```python
# ✅ Good
def get_user_by_email(email: str) -> User | None:
    ...

# ❌ Bad
def get_user_by_email(email):
    ...
```

### Naming Conventions

| Element     | Convention       | Example                |
| ----------- | ---------------- | ---------------------- |
| Files       | snake_case       | `user_service.py`      |
| Classes     | PascalCase       | `UserService`          |
| Functions   | snake_case       | `get_user_by_id`       |
| Variables   | snake_case       | `user_count`           |
| Constants   | UPPER_SNAKE      | `MAX_RETRY_COUNT`      |
| Enums       | PascalCase       | `UserRole.STUDENT`     |

### Architecture Pattern

Follow the **Service-Repository** pattern:

```
Endpoint (router) → Service (business logic) → Repository (data access)
```

- **Endpoints**: Handle HTTP concerns only (request parsing, response formatting)
- **Services**: Contain business logic, validation, orchestration
- **Repositories**: Handle database queries via SQLAlchemy

### API Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": null
}
```

### Error Handling

- Return generic error messages to clients
- Log detailed errors server-side
- Never expose stack traces, SQL errors, or internal paths

---

## JavaScript Standards (Frontend)

### Naming Conventions

| Element     | Convention       | Example                |
| ----------- | ---------------- | ---------------------- |
| Files (components) | PascalCase | `LandingPage.jsx`   |
| Files (utilities)  | camelCase  | `formatDate.js`      |
| Components  | PascalCase       | `<Navbar />`           |
| Functions   | camelCase        | `handleSubmit`         |
| Variables   | camelCase        | `userName`             |
| Constants   | UPPER_SNAKE      | `API_BASE_URL`         |
| CSS classes | kebab-case       | `glass-card`           |

### Component Structure

```jsx
// 1. Imports
import { useState } from 'react';

// 2. Constants / static data
const ITEMS = [...];

// 3. Component
export function MyComponent({ title }) {
  // 3a. Hooks
  const [state, setState] = useState(null);

  // 3b. Handlers
  const handleClick = () => { ... };

  // 3c. Render
  return (
    <div>...</div>
  );
}
```

### State Management

- **Server state**: React Query (caching, refetching, mutations)
- **Local UI state**: `useState` / `useReducer`
- **Global client state**: React Context (only when truly global)

### API Service Pattern

All API calls go through the centralized `services/api.js` client:

```javascript
// services/userService.js
import apiClient from './api';

export const userService = {
  getAll: () => apiClient.get('/users'),
  getById: (id) => apiClient.get(`/users/${id}`),
  create: (data) => apiClient.post('/users', data),
};
```

---

## Environment Variables

### Rules

- **Never** commit `.env` files — only `.env.example`
- **Never** hardcode secrets in source code
- Prefix frontend env vars with `VITE_`
- Use `UPPER_SNAKE_CASE` for all env var names
- Document every variable in `.env.example` with comments

---

## Logging Standards

### Backend

```python
import logging
logger = logging.getLogger("leen_ai")

# ✅ Good — structured, no sensitive data
logger.info("User login successful for user_id=%s", user.id)

# ❌ Bad — logs credentials
logger.info("Login: email=%s password=%s", email, password)
```

### Frontend

```javascript
// ✅ Good
console.info('User profile loaded successfully');

// ❌ Bad — logs user object
console.log('User:', userProfile);
```

---

## File Organization Rules

- One component per file
- Group related files by feature, not by file type
- Keep barrel exports (`index.js`) at folder level
- Colocate tests with source files or in a `tests/` directory
