# GarageSale - Backend API

> Sistema de alquiler de espacios comerciales temporales para ferias en Bolivia.
> API REST + WebSockets construida con Node.js, Express, Prisma y PostgreSQL/PostGIS.

---

## Produccion (Render.com)

La API esta desplegada en:

```
https://garaje-backend.onrender.com
```

**Documentacion interactiva (Swagger UI):**

```
https://garaje-backend.onrender.com/api-docs
```

> Aviso: El plan gratuito de Render hiberna el servidor tras 15 minutos de inactividad.
> La primera peticion puede tardar ~30 segundos en "despertar" el servicio.

---

## Stack Tecnologico

| Tecnologia | Rol |
|---|---|
| Node.js v20 + Express v5 | Servidor HTTP y enrutamiento REST |
| PostgreSQL + PostGIS | Base de datos relacional con soporte geoespacial |
| Prisma ORM v5 | Migrations y acceso a datos |
| JWT + bcryptjs | Autenticacion stateless y hashing de contraseñas |
| Google OAuth 2.0 | Login social via google-auth-library |
| Socket.IO v4 | Chat y notificaciones en tiempo real |
| Cloudflare R2 | Almacenamiento de archivos (bucket publico + privado) |
| Swagger UI Express | Documentacion auto-generada de la API |
| Helmet + CORS + Rate Limit | Seguridad HTTP multicapa |

---

## Instalacion y ejecucion local

### 1. Clonar el repositorio

```bash
git clone https://github.com/GaboMV/GarajeBackend.git
cd GarajeBackend
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita .env con tus valores:

```env
DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/garajes_db?schema=public"
PORT=3000
JWT_SECRET=un_secreto_muy_seguro_aqui

# Cloudflare R2
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key
R2_SECRET_ACCESS_KEY=tu_secret_key
R2_BUCKET_PUBLIC=garajes-public
R2_BUCKET_PRIVATE=garajes-private
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

# Google OAuth 2.0 (Google Cloud Console)
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com

# CORS
FRONTEND_URL=http://localhost:3000
```

### 3. Inicializar la base de datos

```bash
npx prisma generate
npx prisma migrate deploy
```

> Requiere PostgreSQL 15+ con la extension PostGIS instalada.

### 4. Iniciar el servidor

```bash
npm run dev
```

El servidor arranca en: http://localhost:3000

Documentacion Swagger local: http://localhost:3000/api-docs

---

## Como hacer peticiones

### Registro de usuario

**Local:**
```http
POST http://localhost:3000/api/users/register
Content-Type: application/json

{
  "correo": "usuario@example.com",
  "password": "mi_password_seguro",
  "nombre_completo": "Juan Perez"
}
```

**Produccion (Render):**
```http
POST https://garaje-backend.onrender.com/api/users/register
Content-Type: application/json

{
  "correo": "usuario@example.com",
  "password": "mi_password_seguro",
  "nombre_completo": "Juan Perez"
}
```

---

### Login

**Local:**
```http
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "correo": "usuario@example.com",
  "password": "mi_password_seguro"
}
```

**Produccion (Render):**
```http
POST https://garaje-backend.onrender.com/api/users/login
Content-Type: application/json

{
  "correo": "usuario@example.com",
  "password": "mi_password_seguro"
}
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "uuid",
    "correo": "usuario@example.com",
    "esta_verificado": "NO_VERIFICADO"
  }
}
```

---

### Peticiones autenticadas

Todas las rutas protegidas requieren enviar el token JWT en el header:

**Local:**
```http
GET http://localhost:3000/api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Produccion (Render):**
```http
GET https://garaje-backend.onrender.com/api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Busqueda geoespacial de garajes

**Local:**
```http
GET http://localhost:3000/api/search?fecha=2026-04-15&hora_inicio=09:00&hora_fin=13:00&lat=-16.5&lng=-68.15&radio_km=5
Authorization: Bearer <token>
```

**Produccion (Render):**
```http
GET https://garaje-backend.onrender.com/api/search?fecha=2026-04-15&hora_inicio=09:00&hora_fin=13:00&lat=-16.5&lng=-68.15&radio_km=5
Authorization: Bearer <token>
```

---

### Crear una reserva

**Local:**
```http
POST http://localhost:3000/api/reservations
Authorization: Bearer <token>
Content-Type: application/json

{
  "id_garaje": "uuid-del-garaje",
  "tipo_cobro": "POR_HORA",
  "mensaje_inicial": "Hola, me interesa el espacio",
  "acepto_terminos_responsabilidad": true,
  "fechas": [
    {
      "fecha": "2026-04-15",
      "hora_inicio": "09:00",
      "hora_fin": "13:00"
    }
  ]
}
```

**Produccion (Render):**
```http
POST https://garaje-backend.onrender.com/api/reservations
Authorization: Bearer <token>
Content-Type: application/json

{
  "id_garaje": "uuid-del-garaje",
  "tipo_cobro": "POR_HORA",
  "mensaje_inicial": "Hola, me interesa el espacio",
  "acepto_terminos_responsabilidad": true,
  "fechas": [
    {
      "fecha": "2026-04-15",
      "hora_inicio": "09:00",
      "hora_fin": "13:00"
    }
  ]
}
```

---

## Conexion WebSocket (Chat en tiempo real)

```javascript
// Usando socket.io-client
const socket = io("https://garaje-backend.onrender.com", {
  // Para local: io("http://localhost:3000", { ... })
  auth: { token: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
});

// Unirse al chat de una reserva
socket.emit("join_room", { reservaId: "uuid-de-la-reserva" });

// Enviar mensaje
socket.emit("send_message", {
  reservaId: "uuid-de-la-reserva",
  contenido: "Hola, ¿a que hora llegas?"
});

// Recibir mensajes en tiempo real
socket.on("receive_message", (mensaje) => {
  console.log(mensaje.contenido);
});
```

---

## Endpoints principales

| Metodo | Endpoint | Descripcion |
|---|---|---|
| POST | /api/users/register | Registro de usuario |
| POST | /api/users/login | Login con JWT |
| POST | /api/users/google | Login con Google OAuth 2.0 |
| POST | /api/users/kyc | Subir documentos de identidad |
| POST | /api/garages | Publicar garaje |
| GET | /api/search | Busqueda geoespacial de garajes |
| POST | /api/reservations | Crear reserva |
| POST | /api/reservations/:id/pagar | Registrar pago |
| POST | /api/operations/:id/check-in | Check-in |
| POST | /api/operations/:id/check-out | Check-out y liberar fondos |
| GET | /api/finances/billetera | Consultar billetera |
| GET | /api/chat/:id/mensajes | Historial de chat |
| GET | /api/notifications | Notificaciones |

> Ver todos los endpoints en Swagger UI: https://garaje-backend.onrender.com/api-docs

---

## Arquitectura

```
┌─────────────────────────────────────┐
│   Cliente Movil (Flutter)           │
└──────────────┬──────────────────────┘
               │ HTTP REST + WebSocket
┌──────────────▼──────────────────────┐
│   Express API (Render.com)          │
│   ├── routes/         (47 endpoints)│
│   ├── controllers/    (logica)      │
│   ├── middlewares/    (auth/segur.) │
│   └── socket/         (Socket.IO)  │
└──────────────┬──────────────────────┘
               │ Prisma ORM
┌──────────────▼──────────────────────┐
│   PostgreSQL + PostGIS (Neon.tech)  │
└──────────────┬──────────────────────┘
               │ AWS SDK S3-compatible
┌──────────────▼──────────────────────┐
│   Cloudflare R2                     │
│   ├── Bucket Publico  (fotos)       │
│   └── Bucket Privado  (KYC/docs)   │
└─────────────────────────────────────┘
```

---

## Variables de entorno requeridas

| Variable | Descripcion |
|---|---|
| DATABASE_URL | Cadena de conexion PostgreSQL |
| JWT_SECRET | Clave secreta para firmar tokens JWT |
| GOOGLE_CLIENT_ID | Client ID de Google Cloud Console |
| R2_ACCOUNT_ID | ID de cuenta Cloudflare |
| R2_ACCESS_KEY_ID | Clave de acceso R2 |
| R2_SECRET_ACCESS_KEY | Clave secreta R2 |
| R2_BUCKET_PUBLIC | Nombre del bucket publico |
| R2_BUCKET_PRIVATE | Nombre del bucket privado |
| R2_PUBLIC_URL | URL publica del CDN de R2 |
| FRONTEND_URL | Origen permitido por CORS |
| PORT | Puerto del servidor (default: 3000) |

---

## Autor

**Gabriel Mamani** - Arquitectura Full Stack Backend
Universidad Catolica Boliviana "San Pablo" - La Paz, 2026
